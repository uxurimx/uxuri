/**
 * migrate-workspaces.ts — Fase 1 multi-workspace + perfiles
 *
 * 1. Crea las tablas: workspaces, workspace_members, workspace_profiles, workspace_member_profiles
 * 2. Agrega workspace_id (nullable) a todas las tablas de datos
 * 3. Crea workspace "Default" + perfiles seed (Admin, Programador, Tester)
 * 4. Backfill de todos los datos existentes al workspace Default
 *
 * Idempotente: se puede correr varias veces sin romper nada.
 *
 * Run: npx tsx scripts/migrate-workspaces.ts
 */
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const useLocal = process.env.USE_LOCAL_DB === "true";
const connStr = useLocal ? process.env.LOCAL_DATABASE_URL! : process.env.DATABASE_URL!;
if (!connStr) throw new Error("Missing DATABASE_URL or LOCAL_DATABASE_URL");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;
if (useLocal) {
  db = drizzlePg(new Pool({ connectionString: connStr }));
} else {
  db = drizzleNeon(neon(connStr));
}

async function exec(query: string) {
  await db.execute(sql.raw(query));
}

// Tablas que reciben workspace_id (con backfill)
const TABLES_WITH_WORKSPACE = [
  "tasks", "projects", "clients", "agents", "objectives",
  "accounts", "transactions", "bills", "budgets", "savings_goals",
  "mkt_strategies", "mkt_campaigns", "mkt_leads",
  "businesses", "habits", "journal_entries", "notes", "weekly_reviews",
  "time_blocks", "time_sessions", "daily_focus",
  "workflow_columns", "task_categories", "cycle_presets",
  "meal_plans", "shopping_lists", "context_entries",
  "planning_sessions", "shares", "chat_channels",
];

async function run() {
  console.log(`\n🚀 Migración workspaces (${useLocal ? "LOCAL" : "NEON"})\n`);

  // ── 1. Enum workspace_type ─────────────────────────────────────────────────
  await exec(`
    DO $do$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_type') THEN
        CREATE TYPE workspace_type AS ENUM ('personal', 'business');
      END IF;
    END $do$
  `);
  console.log("✅ enum workspace_type");

  // ── 2. Tabla workspaces ────────────────────────────────────────────────────
  await exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name          varchar(255) NOT NULL,
      slug          varchar(100) NOT NULL UNIQUE,
      type          workspace_type NOT NULL DEFAULT 'business',
      description   text,
      brand_name    varchar(255),
      color         varchar(20) DEFAULT '#1e3a5f',
      icon          varchar(10) DEFAULT '🏢',
      owner_id      varchar(255) NOT NULL REFERENCES users(id),
      is_archived   boolean NOT NULL DEFAULT false,
      created_at    timestamp NOT NULL DEFAULT now(),
      updated_at    timestamp NOT NULL DEFAULT now()
    )
  `);
  console.log("✅ tabla workspaces");

  // ── 3. Tabla workspace_members ─────────────────────────────────────────────
  await exec(`
    CREATE TABLE IF NOT EXISTS workspace_members (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      user_id       varchar(255) NOT NULL REFERENCES users(id),
      is_owner      boolean NOT NULL DEFAULT false,
      joined_at     timestamp NOT NULL DEFAULT now()
    )
  `);
  await exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS workspace_member_unique
    ON workspace_members(workspace_id, user_id)
  `);
  console.log("✅ tabla workspace_members");

  // ── 4. Tabla workspace_profiles ────────────────────────────────────────────
  await exec(`
    CREATE TABLE IF NOT EXISTS workspace_profiles (
      id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name              varchar(100) NOT NULL,
      label             varchar(100) NOT NULL,
      description       text,
      color             varchar(20) DEFAULT '#1e3a5f',
      icon              varchar(10) DEFAULT '👤',
      permissions       text[] NOT NULL DEFAULT '{}',
      sidebar_sections  text[] NOT NULL DEFAULT '{}',
      default_route     varchar(200) DEFAULT '/dashboard',
      is_system         boolean NOT NULL DEFAULT false,
      sort_order        text,
      created_at        timestamp NOT NULL DEFAULT now(),
      updated_at        timestamp NOT NULL DEFAULT now()
    )
  `);
  console.log("✅ tabla workspace_profiles");

  // ── 5. Tabla workspace_member_profiles ─────────────────────────────────────
  await exec(`
    CREATE TABLE IF NOT EXISTS workspace_member_profiles (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id     uuid NOT NULL REFERENCES workspace_members(id) ON DELETE CASCADE,
      profile_id    uuid NOT NULL REFERENCES workspace_profiles(id) ON DELETE CASCADE,
      is_default    boolean NOT NULL DEFAULT false,
      assigned_at   timestamp NOT NULL DEFAULT now()
    )
  `);
  await exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS workspace_member_profile_unique
    ON workspace_member_profiles(member_id, profile_id)
  `);
  console.log("✅ tabla workspace_member_profiles");

  // ── 6. Agregar workspace_id a tablas existentes ────────────────────────────
  for (const table of TABLES_WITH_WORKSPACE) {
    await exec(`
      ALTER TABLE ${table}
        ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id)
    `);
  }
  console.log(`✅ workspace_id agregado a ${TABLES_WITH_WORKSPACE.length} tablas`);

  // ── 7. Workspace Default + perfiles seed ───────────────────────────────────
  // Buscar el primer admin para usarlo como owner. Si no hay, primer usuario.
  const ownerRows = await db.execute(sql`
    SELECT id FROM users
    ORDER BY (CASE WHEN role = 'admin' THEN 0 ELSE 1 END), created_at
    LIMIT 1
  `);
  const ownerId = ownerRows.rows?.[0]?.id ?? ownerRows[0]?.id;
  if (!ownerId) {
    console.warn("⚠️  No hay usuarios todavía — saltando seed del workspace Default");
    console.log("\n✨ Migración base completa. Re-ejecuta cuando exista al menos 1 usuario.\n");
    return;
  }

  // Crear workspace Default si no existe
  await exec(`
    INSERT INTO workspaces (name, slug, type, description, color, icon, owner_id)
    VALUES (
      'Default',
      'default',
      'business',
      'Workspace inicial creado automáticamente para datos pre-existentes',
      '#1e3a5f',
      '🏢',
      '${ownerId}'
    )
    ON CONFLICT (slug) DO NOTHING
  `);

  const wsRows = await db.execute(sql`SELECT id FROM workspaces WHERE slug = 'default'`);
  const defaultWorkspaceId = wsRows.rows?.[0]?.id ?? wsRows[0]?.id;
  console.log(`✅ workspace Default: ${defaultWorkspaceId}`);

  // Membership owner
  await exec(`
    INSERT INTO workspace_members (workspace_id, user_id, is_owner)
    VALUES ('${defaultWorkspaceId}', '${ownerId}', true)
    ON CONFLICT DO NOTHING
  `);

  // Perfiles seed
  const allRoutes = [
    "/dashboard", "/clients", "/clients/pipeline", "/projects", "/tasks",
    "/today", "/agents", "/objectives", "/planning", "/habits", "/journal",
    "/notes", "/schedule", "/review", "/chat", "/users", "/finanzas",
    "/comidas", "/negocios", "/marketing", "/settings", "/workspaces",
  ];
  const devRoutes = [
    "/dashboard", "/projects", "/tasks", "/today", "/agents", "/planning",
    "/notes", "/schedule", "/objectives", "/journal", "/chat", "/settings",
  ];
  const testerRoutes = [
    "/dashboard", "/projects", "/tasks", "/today", "/notes", "/chat", "/settings",
  ];

  const profiles = [
    {
      name: "admin", label: "Admin", icon: "👑", color: "#b91c1c",
      description: "Acceso total al workspace",
      permissions: allRoutes,
      defaultRoute: "/dashboard",
    },
    {
      name: "programador", label: "Programador", icon: "💻", color: "#1e40af",
      description: "Foco en tareas y desarrollo",
      permissions: devRoutes,
      defaultRoute: "/tasks",
    },
    {
      name: "tester", label: "Tester / QA", icon: "🧪", color: "#15803d",
      description: "Foco en pruebas, bugs y validación",
      permissions: testerRoutes,
      defaultRoute: "/tasks",
    },
  ];

  for (const p of profiles) {
    const perms = p.permissions.map((r) => `'${r}'`).join(", ");
    await exec(`
      INSERT INTO workspace_profiles
        (workspace_id, name, label, description, color, icon, permissions, default_route, is_system)
      VALUES (
        '${defaultWorkspaceId}',
        '${p.name}',
        '${p.label}',
        '${p.description}',
        '${p.color}',
        '${p.icon}',
        ARRAY[${perms}],
        '${p.defaultRoute}',
        true
      )
      ON CONFLICT DO NOTHING
    `);
  }
  console.log(`✅ ${profiles.length} perfiles seed creados`);

  // Asignar al owner todos los perfiles, admin como default
  const memberRows = await db.execute(sql`
    SELECT id FROM workspace_members
    WHERE workspace_id = ${defaultWorkspaceId} AND user_id = ${ownerId}
  `);
  const memberId = memberRows.rows?.[0]?.id ?? memberRows[0]?.id;

  const profileRows = await db.execute(sql`
    SELECT id, name FROM workspace_profiles WHERE workspace_id = ${defaultWorkspaceId}
  `);
  const profileList = profileRows.rows ?? profileRows;
  for (const prof of profileList) {
    const isDefault = prof.name === "admin";
    await exec(`
      INSERT INTO workspace_member_profiles (member_id, profile_id, is_default)
      VALUES ('${memberId}', '${prof.id}', ${isDefault})
      ON CONFLICT DO NOTHING
    `);
  }
  console.log(`✅ owner asignado a ${profileList.length} perfiles`);

  // ── 8. Backfill: asignar todos los datos existentes al workspace Default ───
  let totalRows = 0;
  for (const table of TABLES_WITH_WORKSPACE) {
    const result = await db.execute(sql.raw(`
      UPDATE ${table} SET workspace_id = '${defaultWorkspaceId}'
      WHERE workspace_id IS NULL
    `));
    const count = result.rowCount ?? result.count ?? 0;
    if (count > 0) {
      console.log(`   • ${table}: ${count} filas`);
      totalRows += count;
    }
  }
  console.log(`✅ backfill total: ${totalRows} filas`);

  console.log(`\n✨ Migración completa.

📋 Próximos pasos sugeridos:
   1. Reiniciar el dev server (npm run dev)
   2. Ir a /workspaces (cuando esté lista la UI) para crear más workspaces
   3. Cada workspace nuevo puede tener sus propios perfiles
\n`);
}

run().catch((err) => {
  console.error("❌ Error en migración:", err);
  process.exit(1);
});
