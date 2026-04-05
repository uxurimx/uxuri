/**
 * sync-db.ts — Sincroniza datos entre Neon y PostgreSQL local.
 *
 * Estrategia: data-only (el schema ya existe en ambos via Drizzle).
 * Trunca todas las tablas del destino antes de restaurar para evitar
 * conflictos de PKs y constraints duplicados.
 *
 * Uso:
 *   npx tsx scripts/sync-db.ts pull   → Neon → local
 *   npx tsx scripts/sync-db.ts push   → local → Neon
 */
import { execSync } from "child_process";
import { writeFileSync } from "fs";

try { process.loadEnvFile(".env.local"); } catch {}

const direction = process.argv[2] as "pull" | "push";
const NEON  = process.env.DATABASE_URL;
const LOCAL = process.env.LOCAL_DATABASE_URL;
const DUMP  = "/tmp/uxuri_data.dump";
const TRUNCATE_SQL = "/tmp/uxuri_truncate.sql";

if (!NEON)  { console.error("❌  DATABASE_URL no configurado");       process.exit(1); }
if (!LOCAL) { console.error("❌  LOCAL_DATABASE_URL no configurado"); process.exit(1); }

function run(cmd: string, opts: { pipe?: boolean } = {}) {
  const label = cmd.trimStart().replace(/".+?"/, '"..."').split(" ").slice(0, 2).join(" ");
  console.log(`→ ${label}`);
  execSync(cmd, { stdio: opts.pipe ? "pipe" : "inherit" });
}

/** Trunca todas las tablas públicas en cascade (limpia el destino antes de restaurar) */
function truncateAll(connStr: string) {
  writeFileSync(
    TRUNCATE_SQL,
    `DO $trunc$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
  LOOP
    EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
  END LOOP;
END $trunc$;`
  );
  execSync(`psql "${connStr}" -f ${TRUNCATE_SQL}`, { stdio: "pipe" });
  console.log("→ truncate OK");
}

/** Dump solo datos (el schema vive en Drizzle, no hay que exportarlo) */
function dumpData(from: string) {
  run(`pg_dump "${from}" --data-only --no-privileges -Fc -f ${DUMP}`);
}

/** Restaura solo datos; ignora warnings de ownership y transaction_timeout */
function restoreData(to: string) {
  try {
    execSync(
      `pg_restore --data-only --no-privileges --no-owner -d "${to}" ${DUMP}`,
      { stdio: "pipe" }
    );
  } catch (e: unknown) {
    const out = (e as { stderr?: Buffer; stdout?: Buffer }).stderr?.toString() ?? "";
    const realErrors = out
      .split("\n")
      .filter(
        (l) =>
          l.includes("error:") &&
          !l.includes("OWNER TO") &&
          !l.includes("transaction_timeout")
      )
      .join("\n")
      .trim();

    if (realErrors) {
      process.stderr.write(out + "\n");
      throw new Error("pg_restore falló con errores reales");
    }
    if (out.trim()) console.log("  (warnings menores ignorados)");
  }
  console.log("→ restore OK");
}

if (direction === "pull") {
  console.log("☁️  → 🏠  Neon → PostgreSQL local...");
  dumpData(NEON!);
  truncateAll(LOCAL!);
  restoreData(LOCAL!);
  console.log("✅  Neon sincronizado a local");
} else if (direction === "push") {
  console.log("🏠  → ☁️  PostgreSQL local → Neon...");
  dumpData(LOCAL!);
  truncateAll(NEON!);
  restoreData(NEON!);
  console.log("✅  Local sincronizado a Neon");
} else {
  console.error("Uso: npx tsx scripts/sync-db.ts [pull|push]");
  process.exit(1);
}
