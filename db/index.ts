import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon, NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { lookup } from "dns/promises";
import { spawn } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import * as schema from "./schema";

const BACKUP_STATE_FILE = "/tmp/uxuri_backup_state.json";

function readBackupState() {
  try { return JSON.parse(readFileSync(BACKUP_STATE_FILE, "utf-8")); } catch { return {}; }
}

/** Lanza backup programado según configuración guardada */
function maybeScheduledBackup() {
  const state = readBackupState();
  const schedule: string = state.schedule ?? "manual";
  const direction: string = state.scheduleDirection ?? "push";
  const lastBackup: string | null = state.lastBackup ?? null;
  if (schedule === "manual") return;

  const intervalMs: Record<string, number> = {
    hourly: 60 * 60 * 1000,
    daily:  24 * 60 * 60 * 1000,
    weekly: 7  * 24 * 60 * 60 * 1000,
  };
  const ms = intervalMs[schedule];
  if (!ms) return;
  if (lastBackup && Date.now() - new Date(lastBackup).getTime() < ms) return;

  console.log(`[db] 📦 Respaldo automático (${schedule}) → ${direction}...`);
  const proc = spawn("npx", ["tsx", "scripts/sync-db.ts", direction], {
    stdio: "pipe", cwd: process.cwd(),
  });
  proc.on("close", (code) => {
    if (code === 0) {
      writeFileSync(BACKUP_STATE_FILE, JSON.stringify({
        ...readBackupState(), lastBackup: new Date().toISOString(), lastDirection: direction,
      }));
      console.log("[db] 📦 Respaldo automático completado");
    }
  });
}

type Db = NeonHttpDatabase<typeof schema>;

// ── Estado mutable ────────────────────────────────────────────────────────────
let _active!: Db;          // instancia activa (Neon o local)
let _isLocal = false;
let _localDb: Db | null = null;
let _neonDb: Db | null = null;
let _watcherOnline: boolean | null = null; // null = no verificado aún
let _syncing = false;
let _watcherStarted = false;

// ── Constructores de instancias ───────────────────────────────────────────────
function getLocalDb(): Db {
  if (!_localDb) {
    _localDb = drizzlePg(
      new Pool({ connectionString: process.env.LOCAL_DATABASE_URL! }),
      { schema }
    ) as unknown as Db;
  }
  return _localDb;
}

function getNeonDb(): Db {
  if (!_neonDb) {
    _neonDb = drizzleNeon(neon(process.env.DATABASE_URL!), { schema });
  }
  return _neonDb;
}

// ── Proxy transparente ────────────────────────────────────────────────────────
// Todos los callers usan `db.select()...` igual — el proxy redirige a _active
// sin que ningún archivo externo cambie nada.
export const db = new Proxy({} as Db, {
  get(_, prop) {
    return (_active as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const isLocalDb = () => _isLocal;

// ── Detección de conectividad ─────────────────────────────────────────────────
async function checkOnline(): Promise<boolean> {
  try {
    // DNS lookup ligero — si resuelve Neon hay internet
    await lookup("console.neon.tech");
    return true;
  } catch {
    return false;
  }
}

// ── Sincronización local → Neon ───────────────────────────────────────────────
function syncLocalToNeon(): Promise<void> {
  return new Promise((resolve) => {
    console.log("[db] 🔄 Sincronizando local → Neon...");
    const proc = spawn("npx", ["tsx", "scripts/sync-db.ts", "push"], {
      stdio: "inherit",
      cwd: process.cwd(),
    });
    proc.on("close", (code) => {
      if (code === 0) console.log("[db] ✅ Sincronización local → Neon completa");
      else console.warn("[db] ⚠️ Sincronización completada con advertencias");
      resolve();
    });
    proc.on("error", (e) => {
      console.warn("[db] ⚠️ Error al sincronizar:", e.message);
      resolve();
    });
  });
}

// ── Watcher de conectividad ───────────────────────────────────────────────────
function startWatcher() {
  if (_watcherStarted) return;
  if (!process.env.LOCAL_DATABASE_URL || !process.env.DATABASE_URL) return;
  _watcherStarted = true;

  const interval = setInterval(async () => {
    maybeScheduledBackup();
    if (_syncing) return;

    const online = await checkOnline();
    if (online === _watcherOnline) return; // sin cambio

    if (online && _watcherOnline === false) {
      // ── OFFLINE → ONLINE ────────────────────────────────────────────────────
      // Actualizar estado ANTES de await para evitar double-trigger si el interval
      // vuelve a disparar mientras el sync está en curso
      _watcherOnline = online;
      _syncing = true;
      console.log("[db] 🌐 Internet detectado → sincronizando y cambiando a Neon...");
      await syncLocalToNeon();
      _active = getNeonDb();
      _isLocal = false;
      _syncing = false;
      console.log("[db] ☁️  Neon activo");
    } else if (!online && _watcherOnline === true) {
      // ── ONLINE → OFFLINE ────────────────────────────────────────────────────
      _watcherOnline = online;
      console.log("[db] 📴 Internet perdido → cambiando a PostgreSQL local");
      _active = getLocalDb();
      _isLocal = true;
    } else {
      _watcherOnline = online;
    }
  }, 15_000); // chequea cada 15 segundos

  // No bloquear el cierre limpio del proceso
  interval.unref();
}

// ── Inicialización ────────────────────────────────────────────────────────────
async function init() {
  // Producción: Neon siempre, sin watcher
  if (process.env.NODE_ENV === "production") {
    _active = getNeonDb();
    return;
  }

  // Override explícito USE_LOCAL_DB=true
  if (process.env.USE_LOCAL_DB === "true") {
    _active = getLocalDb();
    _isLocal = true;
    _watcherOnline = false;
    console.log("[db] 🏠 PostgreSQL local (USE_LOCAL_DB forzado)");
    startWatcher();
    return;
  }

  // Dev: preferir local si está disponible → inmune a caídas de internet
  if (process.env.LOCAL_DATABASE_URL) {
    try {
      const pool = new Pool({
        connectionString: process.env.LOCAL_DATABASE_URL,
        connectionTimeoutMillis: 2000,
      });
      await pool.query("SELECT 1");
      _localDb = drizzlePg(pool, { schema }) as unknown as Db;
      _active = _localDb;
      _isLocal = true;

      const online = await checkOnline();
      _watcherOnline = online;
      console.log(
        `[db] 🏠 PostgreSQL local${online ? " · Neon disponible, watcher activo" : " · sin internet"}`
      );
      startWatcher();
      return;
    } catch {
      console.warn("[db] ⚠️  PostgreSQL local no disponible → intentando Neon");
    }
  }

  // Último fallback: Neon directo
  const online = await checkOnline();
  if (online) {
    _active = getNeonDb();
    _watcherOnline = true;
    console.log("[db] ☁️  Neon conectado");
    if (process.env.LOCAL_DATABASE_URL) startWatcher();
    return;
  }

  throw new Error("[db] ❌ Sin base de datos disponible (local ni Neon alcanzan)");
}

await init();
