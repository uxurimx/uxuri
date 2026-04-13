/**
 * migrate-crm.ts — Migración CRM/Finanzas
 * Crea los nuevos enums, columnas y tablas para:
 *  - Pipeline CRM en clients
 *  - Finanzas de proyecto (project_phases, project_payments)
 * Run: npx tsx scripts/migrate-crm.ts
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = neon(process.env.DATABASE_URL!);
const db = drizzle(client);

async function exec(query: string) {
  await db.execute(sql.raw(query));
}

async function run() {
  console.log("🚀 Iniciando migración CRM/Finanzas...\n");

  // ── 1. Fix mkt_campaign_status (text → enum) ──────────────────────────────
  try {
    await exec(`
      DO $do$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mkt_campaign_status') THEN
          CREATE TYPE mkt_campaign_status AS ENUM (
            'draft','queued','claimed','scraping','running','paused','completed','failed'
          );
        END IF;
      END $do$
    `);
    await exec(`
      DO $do$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'mkt_campaigns'
            AND column_name = 'status'
            AND data_type = 'text'
        ) THEN
          ALTER TABLE mkt_campaigns
            ALTER COLUMN status TYPE mkt_campaign_status
            USING status::mkt_campaign_status;
        END IF;
      END $do$
    `);
    console.log("✅ mkt_campaign_status enum OK");
  } catch (e) {
    console.warn("⚠️  mkt_campaign_status:", (e as Error).message);
  }

  // ── 2. Client pipeline enums ──────────────────────────────────────────────
  await exec(`
    DO $do$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_pipeline_stage') THEN
        CREATE TYPE client_pipeline_stage AS ENUM (
          'contacto','lead','prospecto','propuesta','negociacion',
          'cliente','recurrente','churned'
        );
      END IF;
    END $do$
  `);
  console.log("✅ client_pipeline_stage enum");

  await exec(`
    DO $do$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'client_source_channel') THEN
        CREATE TYPE client_source_channel AS ENUM (
          'whatsapp','instagram','facebook','referral','web','directo','email','otro'
        );
      END IF;
    END $do$
  `);
  console.log("✅ client_source_channel enum");

  // ── 3. New columns on clients ─────────────────────────────────────────────
  await exec(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS pipeline_stage client_pipeline_stage DEFAULT 'contacto'`);
  await exec(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS source_business_id uuid`);
  await exec(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS source_channel client_source_channel`);
  await exec(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS first_contact_date date`);
  await exec(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS estimated_value numeric(18,2)`);
  console.log("✅ clients: columnas CRM agregadas");

  // ── 4. project_contract_type enum ─────────────────────────────────────────
  await exec(`
    DO $do$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_contract_type') THEN
        CREATE TYPE project_contract_type AS ENUM (
          'fixed','hourly','retainer','per_phase','milestone'
        );
      END IF;
    END $do$
  `);
  console.log("✅ project_contract_type enum");

  // ── 5. New columns on projects ────────────────────────────────────────────
  await exec(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS total_amount numeric(18,2)`);
  await exec(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS currency varchar(10) DEFAULT 'MXN'`);
  await exec(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS payment_type project_contract_type DEFAULT 'fixed'`);
  console.log("✅ projects: columnas financieras agregadas");

  // ── 6. project_phase_status enum ──────────────────────────────────────────
  await exec(`
    DO $do$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_phase_status') THEN
        CREATE TYPE project_phase_status AS ENUM ('pending','active','completed','cancelled');
      END IF;
    END $do$
  `);
  console.log("✅ project_phase_status enum");

  // ── 7. project_phases table ───────────────────────────────────────────────
  await exec(`
    CREATE TABLE IF NOT EXISTS project_phases (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name varchar(255) NOT NULL,
      description text,
      "order" integer NOT NULL DEFAULT 0,
      status project_phase_status NOT NULL DEFAULT 'pending',
      completion_percent integer NOT NULL DEFAULT 0,
      due_date date,
      billing_amount numeric(18,2),
      billing_currency varchar(10) DEFAULT 'MXN',
      billed_at timestamp,
      created_by varchar(255) REFERENCES users(id),
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  console.log("✅ project_phases table");

  // ── 8. project_payment enums ──────────────────────────────────────────────
  await exec(`
    DO $do$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_payment_type') THEN
        CREATE TYPE project_payment_type AS ENUM ('anticipo','abono','pago_final','reembolso','otro');
      END IF;
    END $do$
  `);
  await exec(`
    DO $do$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_payment_status') THEN
        CREATE TYPE project_payment_status AS ENUM ('pending','paid','overdue','cancelled');
      END IF;
    END $do$
  `);
  await exec(`
    DO $do$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_payment_method') THEN
        CREATE TYPE project_payment_method AS ENUM ('transferencia','efectivo','tarjeta','paypal','crypto','otro');
      END IF;
    END $do$
  `);
  console.log("✅ project_payment enums");

  // ── 9. project_payments table ─────────────────────────────────────────────
  await exec(`
    CREATE TABLE IF NOT EXISTS project_payments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      client_id uuid REFERENCES clients(id),
      phase_id uuid,
      concept varchar(500) NOT NULL,
      amount numeric(18,2) NOT NULL,
      currency varchar(10) NOT NULL DEFAULT 'MXN',
      type project_payment_type NOT NULL DEFAULT 'abono',
      status project_payment_status NOT NULL DEFAULT 'pending',
      method project_payment_method,
      due_date date,
      paid_at timestamp,
      notes text,
      reference varchar(255),
      created_by varchar(255) REFERENCES users(id),
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  console.log("✅ project_payments table");

  console.log("\n🎉 Migración completada exitosamente!");
}

run().catch(e => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
