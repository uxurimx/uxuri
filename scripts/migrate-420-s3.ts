import { neon } from "@neondatabase/serverless";

process.loadEnvFile(".env.local");
const sql = neon(process.env.DATABASE_URL!);

async function run() {
  console.log("Migrating 420 Sprint 3 schema...");

  // deep_breaths table
  await sql`
    CREATE TABLE IF NOT EXISTS deep_breaths (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id VARCHAR(255) NOT NULL REFERENCES users(id),
      session_id UUID REFERENCES smoke_sessions(id) ON DELETE SET NULL,
      duration_seconds INTEGER NOT NULL,
      trip_duration_seconds INTEGER,
      trip_details TEXT,
      minutes_mark INTEGER,
      date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `;
  console.log("✓ deep_breaths");

  // smoke_events table (re-fumar tracking)
  await sql`
    CREATE TABLE IF NOT EXISTS smoke_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES smoke_sessions(id) ON DELETE CASCADE,
      user_id VARCHAR(255) NOT NULL,
      minutes_mark INTEGER NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `;
  console.log("✓ smoke_events");

  // Add target_duration to smoke_sessions (for countdown timer)
  await sql`
    ALTER TABLE smoke_sessions
    ADD COLUMN IF NOT EXISTS target_duration INTEGER
  `;
  console.log("✓ smoke_sessions.target_duration");

  // Indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_deep_breaths_user_date ON deep_breaths(user_id, date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_smoke_events_session ON smoke_events(session_id)`;

  console.log("✅ Migration complete.");
}

run().catch((e) => { console.error(e); process.exit(1); });
