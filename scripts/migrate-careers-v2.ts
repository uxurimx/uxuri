/**
 * migrate-careers-v2.ts — Fase 0: schema para modos de aplicación disruptivos
 * Run: npx tsx scripts/migrate-careers-v2.ts
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = neon(process.env.DATABASE_URL!);
const db = drizzle(client);

async function exec(query: string, label: string) {
  try {
    await db.execute(sql.raw(query));
    console.log(`✅ ${label}`);
  } catch (e) {
    console.warn(`⚠️  ${label}: ${(e as Error).message}`);
  }
}

async function run() {
  console.log("🚀 Fase 0 — Careers v2 schema\n");

  // ── 1. job_application_type enum ──────────────────────────────────────────
  await exec(`
    DO $do$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_application_type') THEN
        CREATE TYPE job_application_type AS ENUM (
          'form', 'challenge', 'conversation', 'video', 'hybrid'
        );
      END IF;
    END $do$
  `, "job_application_type enum");

  // ── 2. job_postings — nuevas columnas ─────────────────────────────────────
  await exec(`ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS
    application_type job_application_type NOT NULL DEFAULT 'form'`,
    "job_postings.application_type");

  await exec(`ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS
    challenge_brief text`,
    "job_postings.challenge_brief");

  await exec(`ALTER TABLE job_postings ADD COLUMN IF NOT EXISTS
    challenge_deadline_hours integer DEFAULT 48`,
    "job_postings.challenge_deadline_hours");

  // ── 3. job_applications — columnas de submission ──────────────────────────
  await exec(`ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS
    submission_url varchar(1000)`,
    "job_applications.submission_url");

  await exec(`ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS
    submission_notes text`,
    "job_applications.submission_notes");

  await exec(`ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS
    submission_file_url varchar(1000)`,
    "job_applications.submission_file_url");

  // ── 4. job_applications — video responses ────────────────────────────────
  await exec(`ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS
    video_responses jsonb NOT NULL DEFAULT '[]'`,
    "job_applications.video_responses");

  // ── 5. job_applications — conversation ref ───────────────────────────────
  await exec(`ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS
    conversation_id uuid`,
    "job_applications.conversation_id");

  // ── 6. job_applications — AI scoring ─────────────────────────────────────
  await exec(`ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS
    ai_score integer`,
    "job_applications.ai_score");

  await exec(`ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS
    ai_summary text`,
    "job_applications.ai_summary");

  await exec(`ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS
    ai_flags jsonb NOT NULL DEFAULT '[]'`,
    "job_applications.ai_flags");

  await exec(`ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS
    ai_recommendation varchar(20)`,
    "job_applications.ai_recommendation");

  await exec(`ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS
    ai_scored_at timestamp`,
    "job_applications.ai_scored_at");

  // ── 7. job_conversation_role enum ────────────────────────────────────────
  await exec(`
    DO $do$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_conversation_role') THEN
        CREATE TYPE job_conversation_role AS ENUM ('system', 'assistant', 'user');
      END IF;
    END $do$
  `, "job_conversation_role enum");

  // ── 8. job_conversations table ───────────────────────────────────────────
  await exec(`
    CREATE TABLE IF NOT EXISTS job_conversations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      application_id uuid NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
      role job_conversation_role NOT NULL,
      content text NOT NULL,
      turn_index integer NOT NULL DEFAULT 0,
      metadata jsonb,
      created_at timestamp NOT NULL DEFAULT now()
    )
  `, "job_conversations table");

  await exec(`
    CREATE INDEX IF NOT EXISTS job_conversations_application_idx
    ON job_conversations(application_id, turn_index)
  `, "job_conversations index");

  console.log("\n🎉 Fase 0 completada. Schema listo para los 4 modos de aplicación.");
  console.log("\nPróximo paso: Fase 1 — Challenge Mode");
}

run().catch(e => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
