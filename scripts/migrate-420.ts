import { neon } from "@neondatabase/serverless";

process.loadEnvFile(".env.local");
const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("🌿 Migrando módulo 420...\n");

  await sql`
    DO $$ BEGIN
      CREATE TYPE smoke_type AS ENUM ('sativa','indica','hybrid','cbd','hash','concentrate');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `;
  console.log("✓ Enum smoke_type");

  await sql`
    DO $$ BEGIN
      CREATE TYPE smoke_method AS ENUM ('joint','pipe','vape','edible','bong','dab');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `;
  console.log("✓ Enum smoke_method");

  await sql`
    DO $$ BEGIN
      CREATE TYPE smoke_amount AS ENUM ('micro','low','medium','heavy','very_heavy');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `;
  console.log("✓ Enum smoke_amount");

  await sql`
    DO $$ BEGIN
      CREATE TYPE smoke_status AS ENUM ('active','closed');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `;
  console.log("✓ Enum smoke_status");

  await sql`
    DO $$ BEGIN
      CREATE TYPE smoke_note_type AS ENUM ('text','voice','insight','task');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `;
  console.log("✓ Enum smoke_note_type");

  await sql`
    CREATE TABLE IF NOT EXISTS smoke_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL REFERENCES users(id),
      type smoke_type NOT NULL,
      method smoke_method NOT NULL,
      amount smoke_amount NOT NULL,
      strain VARCHAR(255),
      started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      ended_at TIMESTAMP,
      elapsed_seconds INTEGER,
      status smoke_status NOT NULL DEFAULT 'active',
      mood_before INTEGER,
      creativity_rating INTEGER,
      relax_rating INTEGER,
      focus_rating INTEGER,
      euphoria_rating INTEGER,
      depth_rating INTEGER,
      mood_after INTEGER,
      overall_rating INTEGER,
      summary TEXT,
      ai_summary TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;
  console.log("✓ Tabla smoke_sessions");

  await sql`
    CREATE TABLE IF NOT EXISTS smoke_checkins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES smoke_sessions(id) ON DELETE CASCADE,
      user_id VARCHAR(255) NOT NULL,
      minutes_mark INTEGER NOT NULL,
      intensity INTEGER NOT NULL,
      tags TEXT[],
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;
  console.log("✓ Tabla smoke_checkins");

  await sql`
    CREATE TABLE IF NOT EXISTS smoke_notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES smoke_sessions(id) ON DELETE CASCADE,
      user_id VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      type smoke_note_type NOT NULL DEFAULT 'text',
      tags TEXT[],
      minutes_mark INTEGER,
      converted_to_task BOOLEAN NOT NULL DEFAULT false,
      task_id UUID,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;
  console.log("✓ Tabla smoke_notes");

  console.log("\n🌿 Migración completada. Ejecuta el servidor con npm run dev.");
}

main().catch((e) => { console.error(e); process.exit(1); });
