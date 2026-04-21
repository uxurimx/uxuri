/**
 * Migración Fase 3: commitHash + commitUrl en tasks
 * Ejecutar: npx tsx scripts/migrate-agents-phase3.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";

function loadEnv(file: string) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv(".env.local");
loadEnv(".env");

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("🚀 Migración Fase 3...\n");
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS commit_hash varchar(40)`;
  await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS commit_url varchar(500)`;
  console.log("✅ tasks.commit_hash + tasks.commit_url agregados.");
}

main().catch((e) => { console.error(e); process.exit(1); });
