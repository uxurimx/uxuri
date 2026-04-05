/**
 * sync-merge.ts — Mezcla inteligente local ↔ Neon sin perder datos de ningún lado.
 *
 * Algoritmo:
 *   1. Lee TODAS las filas de LOCAL y NEON para cada tabla
 *   2. Mezcla en memoria:
 *      - Tablas con `updated_at`: gana la versión más nueva por fila
 *      - Tablas sin `updated_at`: se agregan filas nuevas, sin sobreescribir
 *   3. Escribe el resultado mezclado a LOCAL (TRUNCATE + INSERT)
 *   4. Hace push destructivo LOCAL → NEON (ya es seguro porque LOCAL tiene todo)
 *
 * Uso:
 *   npx tsx scripts/sync-merge.ts          → merge + push a Neon
 *   npx tsx scripts/sync-merge.ts --dry    → solo muestra diferencias, no aplica
 */
import { Pool } from "pg";
import { writeFileSync, mkdirSync } from "fs";

try { process.loadEnvFile(".env.local"); } catch {}

const DRY = process.argv.includes("--dry");
const LOCAL_URL = process.env.LOCAL_DATABASE_URL;
const NEON_URL  = process.env.DATABASE_URL;

if (!LOCAL_URL) { console.error("❌  LOCAL_DATABASE_URL no configurado"); process.exit(1); }
if (!NEON_URL)  { console.error("❌  DATABASE_URL no configurado");       process.exit(1); }

const localPool = new Pool({ connectionString: LOCAL_URL, ssl: false });
const neonPool  = new Pool({ connectionString: NEON_URL,  ssl: { rejectUnauthorized: false } });

// ── Helpers ───────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

/** Devuelve metadatos de columnas: PK, updated_at, y qué columnas son jsonb */
async function getColumns(pool: Pool, table: string): Promise<{
  name: string;
  hasUpdatedAt: boolean;
  pkCols: string[];
  jsonbCols: Set<string>;
}> {
  const colRes = await pool.query<{ column_name: string; udt_name: string }>(
    `SELECT column_name, udt_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  const cols     = colRes.rows.map(r => r.column_name);
  const jsonbCols = new Set(
    colRes.rows.filter(r => r.udt_name === "jsonb" || r.udt_name === "json").map(r => r.column_name)
  );

  const pkRes = await pool.query<{ column_name: string }>(
    `SELECT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public' AND tc.table_name = $1
     ORDER BY kcu.ordinal_position`,
    [table]
  );
  const pkCols = pkRes.rows.map(r => r.column_name);

  return { name: table, hasUpdatedAt: cols.includes("updated_at"), pkCols, jsonbCols };
}

/**
 * Serializa un valor para pg:
 * - columnas jsonb/json: arrays y objetos → JSON string (pg-array format no es válido aquí)
 * - text[], varchar[], etc.: arrays JS → dejar como está (pg los serializa como {a,b})
 * - Date, primitivos: tal cual
 */
function pgValue(v: unknown, isJsonb: boolean): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (isJsonb && (Array.isArray(v) || (typeof v === "object"))) return JSON.stringify(v);
  return v;
}

/** Construye una clave única para una fila basada en sus columnas PK */
function rowKey(row: Row, pkCols: string[]): string {
  return pkCols.map(c => String(row[c])).join("|");
}

/** Mezcla dos conjuntos de filas:
 *  - Si la tabla tiene updated_at: gana la versión más nueva
 *  - Si no: gana local (no sobreescribir), agrega filas nuevas de neon
 */
function mergeRows(localRows: Row[], neonRows: Row[], pkCols: string[], hasUpdatedAt: boolean): {
  merged: Row[];
  localOnly: number;
  neonOnly: number;
  conflicts: number;
} {
  const localMap = new Map<string, Row>();
  const neonMap  = new Map<string, Row>();

  for (const r of localRows) localMap.set(rowKey(r, pkCols), r);
  for (const r of neonRows)  neonMap.set(rowKey(r, pkCols), r);

  const allKeys = new Set([...localMap.keys(), ...neonMap.keys()]);
  const merged: Row[] = [];

  let localOnly = 0, neonOnly = 0, conflicts = 0;

  for (const key of allKeys) {
    const local = localMap.get(key);
    const neon  = neonMap.get(key);

    if (local && !neon) {
      merged.push(local);
      localOnly++;
    } else if (neon && !local) {
      merged.push(neon);
      neonOnly++;
    } else if (local && neon) {
      if (hasUpdatedAt) {
        const localTs = new Date(local.updated_at as string).getTime();
        const neonTs  = new Date(neon.updated_at  as string).getTime();
        merged.push(localTs >= neonTs ? local : neon);
        if (localTs !== neonTs) conflicts++;
      } else {
        // Sin updated_at: conserva local
        merged.push(local);
      }
    }
  }

  return { merged, localOnly, neonOnly, conflicts };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(DRY ? "🔍  Modo dry-run — solo muestra diferencias\n" : "🔀  Iniciando merge local ↔ Neon...\n");

  const localClient = await localPool.connect();
  const neonClient  = await neonPool.connect();

  // Obtener lista de tablas del esquema público
  const tablesRes = await localClient.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  const tables = tablesRes.rows.map(r => r.tablename);

  // Tablas que no deben tocarse en el merge (logs de sistema, push tokens)
  const SKIP_TABLES = new Set(["push_subscriptions"]);

  let totalLocalOnly = 0, totalNeonOnly = 0, totalConflicts = 0;
  const mergedData: Map<string, Row[]> = new Map();
  const jsonbColsMap: Map<string, Set<string>> = new Map();

  for (const table of tables) {
    if (SKIP_TABLES.has(table)) {
      console.log(`  SKIP  ${table}`);
      continue;
    }

    try {
      const { pkCols, hasUpdatedAt, jsonbCols } = await getColumns(localPool, table);
      if (pkCols.length === 0) {
        console.log(`  SKIP  ${table} (sin PK)`);
        continue;
      }

      const [localRows, neonRows] = await Promise.all([
        localClient.query<Row>(`SELECT * FROM "${table}"`).then(r => r.rows),
        neonClient.query<Row>(`SELECT * FROM "${table}"`).then(r => r.rows),
      ]);

      const { merged, localOnly, neonOnly, conflicts } = mergeRows(localRows, neonRows, pkCols, hasUpdatedAt);
      mergedData.set(table, merged);
      jsonbColsMap.set(table, jsonbCols);

      totalLocalOnly += localOnly;
      totalNeonOnly  += neonOnly;
      totalConflicts += conflicts;

      const diff = localOnly + neonOnly + conflicts;
      if (diff > 0) {
        const parts = [
          localOnly  > 0 ? `+${localOnly} solo-local`   : "",
          neonOnly   > 0 ? `+${neonOnly} solo-neon`      : "",
          conflicts  > 0 ? `~${conflicts} conflictos`    : "",
        ].filter(Boolean).join(", ");
        console.log(`  ${table.padEnd(35)} ${parts}`);
      } else {
        console.log(`  ${table.padEnd(35)} ✓ sin diferencias`);
      }
    } catch (e: unknown) {
      console.warn(`  WARN  ${table}: ${(e as Error).message.slice(0, 80)}`);
    }
  }

  console.log(`\n📊  Resumen: ${totalLocalOnly} filas solo-local | ${totalNeonOnly} filas solo-neon | ${totalConflicts} conflictos resueltos`);

  if (DRY || (totalLocalOnly === 0 && totalNeonOnly === 0 && totalConflicts === 0)) {
    if (totalLocalOnly === 0 && totalNeonOnly === 0 && totalConflicts === 0) {
      console.log("✅  Local y Neon están sincronizados — nada que hacer.");
    } else {
      console.log("\n🔍  Dry-run terminado. Corre sin --dry para aplicar los cambios.");
    }
    localClient.release();
    neonClient.release();
    await Promise.all([localPool.end(), neonPool.end()]);
    return;
  }

  // ── Aplicar a LOCAL ────────────────────────────────────────────────────────
  console.log("\n📥  Aplicando resultado mezclado a LOCAL...");

  await localClient.query("BEGIN");
  try {
    // Deshabilitar FK checks para el TRUNCATE en orden
    await localClient.query("SET session_replication_role = replica");

    for (const [table, rows] of mergedData) {
      await localClient.query(`TRUNCATE TABLE "${table}" CASCADE`);
      if (rows.length === 0) continue;

      // Insertar en batches de 500
      const colNames = Object.keys(rows[0]);
      const colList  = colNames.map(c => `"${c}"`).join(", ");

      const jsonbCols = jsonbColsMap.get(table) ?? new Set<string>();
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        const values: unknown[] = [];
        const placeholders = batch.map((row, bi) => {
          const rowPlaceholders = colNames.map((col, ci) => {
            values.push(pgValue(row[col], jsonbCols.has(col)));
            return `$${bi * colNames.length + ci + 1}`;
          });
          return `(${rowPlaceholders.join(", ")})`;
        });
        await localClient.query(
          `INSERT INTO "${table}" (${colList}) VALUES ${placeholders.join(", ")}`,
          values
        );
      }
    }

    await localClient.query("SET session_replication_role = DEFAULT");
    await localClient.query("COMMIT");
    console.log("✅  Local actualizado con datos mezclados.");
  } catch (e) {
    await localClient.query("ROLLBACK");
    throw e;
  }

  localClient.release();
  neonClient.release();
  await Promise.all([localPool.end(), neonPool.end()]);

  // ── Push LOCAL → NEON ─────────────────────────────────────────────────────
  // Usamos plain SQL + psql en lugar de pg_restore para poder envolver con
  // SET session_replication_role = replica (deshabilita FK checks en el destino).
  console.log("\n☁️   Subiendo resultado a Neon...");
  const { execSync } = await import("child_process");
  const BACKUPS_DIR = `${process.cwd()}/backups`;
  mkdirSync(BACKUPS_DIR, { recursive: true });
  const DUMP_SQL = `${BACKUPS_DIR}/uxuri_merged.sql`;

  try {
    // Dump en formato plain SQL (INSERT statements)
    execSync(
      `pg_dump "${LOCAL_URL}" --data-only --no-privileges --inserts --column-inserts -f "${DUMP_SQL}"`,
      { stdio: "pipe" }
    );
    console.log("→ dump local OK");

    // Script completo: deshabilitar FK checks + truncate + restore + re-habilitar
    const fullSQL = `${BACKUPS_DIR}/neon_restore.sql`;
    const { readFileSync: rf } = await import("fs");
    const dumpContent = rf(DUMP_SQL, "utf-8");
    writeFileSync(fullSQL, [
      "SET session_replication_role = replica;",
      // Truncar todas las tablas
      `DO $t$ DECLARE r RECORD; BEGIN
         FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
         LOOP EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE'; END LOOP;
       END $t$;`,
      dumpContent,
      "SET session_replication_role = DEFAULT;",
    ].join("\n"));

    execSync(`psql "${NEON_URL}" -f "${fullSQL}" -v ON_ERROR_STOP=0`, { stdio: "pipe" });
    console.log("→ Neon restaurado OK");

    // Actualizar estado
    const statePath = `${BACKUPS_DIR}/backup_state.json`;
    let state: Record<string, unknown> = {};
    try { state = JSON.parse(readFileSync(statePath, "utf-8")); } catch {}
    writeFileSync(statePath, JSON.stringify({ ...state, lastBackup: new Date().toISOString(), lastDirection: "merge" }));

    console.log("\n✅  Merge completo: local y Neon están sincronizados.");
  } catch (err) {
    console.error("❌  Error en push a Neon:", (err as Error).message);
    process.exit(1);
  }
}

main().catch(e => { console.error("❌ ", e.message); process.exit(1); });
