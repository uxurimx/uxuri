/**
 * Migración Fase 1: Agentes globales + código vinculado en proyectos
 *
 * Ejecutar: npx tsx scripts/migrate-agents-phase1.ts
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
  console.log("🚀 Iniciando migración Fase 1...\n");

  // 1. agents.is_global
  console.log("1. Agregando agents.is_global...");
  await sql`
    ALTER TABLE agents
    ADD COLUMN IF NOT EXISTS is_global boolean NOT NULL DEFAULT false
  `;
  console.log("   ✓ agents.is_global");

  // 2. projects: linked_code_path, linked_repo, tech_stack
  console.log("2. Agregando campos de código a projects...");
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS linked_code_path text`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS linked_repo varchar(500)`;
  await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS tech_stack text`;
  console.log("   ✓ projects.linked_code_path, linked_repo, tech_stack");

  // 3. agent_project_assignments
  console.log("3. Creando tabla agent_project_assignments...");
  await sql`
    CREATE TABLE IF NOT EXISTS agent_project_assignments (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      agent_id    uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      scope       text,
      created_by  varchar(255) REFERENCES users(id),
      created_at  timestamp NOT NULL DEFAULT now(),
      UNIQUE(agent_id, project_id)
    )
  `;
  console.log("   ✓ agent_project_assignments");

  console.log("\n✅ Migración completada.");
}

main().catch((e) => { console.error(e); process.exit(1); });
