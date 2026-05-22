/**
 * migrate-jobs.ts
 * 1. Fix mkt_campaign_status text→enum (pendiente desde migrate-crm.ts)
 * 2. Crear tablas job_postings, job_questions, job_applications
 * Run: npx tsx scripts/migrate-jobs.ts
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
  console.log("🚀 Iniciando migración Jobs...\n");

  // ── 1. Fix mkt_campaign_status (text → enum) ──────────────────────────────
  try {
    // Crear enum si no existe
    await exec(`
      DO $do$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mkt_campaign_status') THEN
          CREATE TYPE mkt_campaign_status AS ENUM (
            'draft','queued','claimed','scraping','enriching',
            'ready','scheduled','running','paused','completed','failed'
          );
        END IF;
      END $do$
    `);

    // Agregar valores faltantes al enum si ya existía (enrich/ready/scheduled)
    for (const val of ['enriching', 'ready', 'scheduled']) {
      await exec(`
        DO $do$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumtypid = 'mkt_campaign_status'::regtype
              AND enumlabel = '${val}'
          ) THEN
            ALTER TYPE mkt_campaign_status ADD VALUE '${val}';
          END IF;
        END $do$
      `);
    }

    // Castear columna si sigue siendo text
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
    console.log("✅ mkt_campaign_status enum + cast OK");
  } catch (e) {
    console.warn("⚠️  mkt_campaign_status:", (e as Error).message);
  }

  // ── 2. job_status enum ────────────────────────────────────────────────────
  await exec(`
    DO $do$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
        CREATE TYPE job_status AS ENUM ('draft','open','paused','closed');
      END IF;
    END $do$
  `);
  console.log("✅ job_status enum");

  // ── 3. job_employment_type enum ───────────────────────────────────────────
  await exec(`
    DO $do$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_employment_type') THEN
        CREATE TYPE job_employment_type AS ENUM (
          'fixed_salary','commission','mixed','equity_partner'
        );
      END IF;
    END $do$
  `);
  console.log("✅ job_employment_type enum");

  // ── 4. job_postings table ─────────────────────────────────────────────────
  await exec(`
    CREATE TABLE IF NOT EXISTS job_postings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id uuid REFERENCES workspaces(id),
      business_id uuid REFERENCES businesses(id),
      created_by varchar(255) NOT NULL REFERENCES users(id),
      title varchar(200) NOT NULL,
      slug varchar(200) NOT NULL UNIQUE,
      tagline text,
      description text,
      requirements text,
      employment_type job_employment_type DEFAULT 'commission',
      status job_status NOT NULL DEFAULT 'draft',
      closes_at timestamp,
      max_applications integer,
      is_public boolean NOT NULL DEFAULT true,
      view_count integer NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  console.log("✅ job_postings table");

  // ── 5. job_question_type enum ─────────────────────────────────────────────
  await exec(`
    DO $do$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_question_type') THEN
        CREATE TYPE job_question_type AS ENUM (
          'text','textarea','url','video','select','multiselect','choice'
        );
      END IF;
    END $do$
  `);
  console.log("✅ job_question_type enum");

  // ── 6. job_questions table ────────────────────────────────────────────────
  await exec(`
    CREATE TABLE IF NOT EXISTS job_questions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id uuid NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
      question text NOT NULL,
      type job_question_type NOT NULL DEFAULT 'textarea',
      options text[] DEFAULT '{}',
      is_required boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      placeholder varchar(500),
      hint text,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `);
  console.log("✅ job_questions table");

  // ── 7. job_application_status enum ───────────────────────────────────────
  await exec(`
    DO $do$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_application_status') THEN
        CREATE TYPE job_application_status AS ENUM (
          'new','reviewing','shortlisted','interview','hired','rejected'
        );
      END IF;
    END $do$
  `);
  console.log("✅ job_application_status enum");

  // ── 8. job_applications table ─────────────────────────────────────────────
  await exec(`
    CREATE TABLE IF NOT EXISTS job_applications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id uuid NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
      name varchar(200) NOT NULL,
      email varchar(200) NOT NULL,
      phone varchar(50),
      answers jsonb NOT NULL DEFAULT '[]',
      status job_application_status NOT NULL DEFAULT 'new',
      score integer,
      notes text,
      source varchar(100),
      applied_at timestamp NOT NULL DEFAULT now(),
      reviewed_at timestamp,
      reviewed_by varchar(255) REFERENCES users(id)
    )
  `);
  console.log("✅ job_applications table");

  console.log("\n🎉 Migración completada exitosamente!");
}

run().catch(e => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
