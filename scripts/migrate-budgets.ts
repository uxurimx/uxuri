import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const NEON_URL  = process.env.DATABASE_URL!;
const LOCAL_URL = process.env.LOCAL_DATABASE_URL!;

async function migrateNeon() {
  if (!NEON_URL) { console.log("⚠  DATABASE_URL no definido, saltando Neon"); return; }
  const sql = neon(NEON_URL);

  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_period') THEN
        CREATE TYPE budget_period AS ENUM ('weekly','monthly','yearly');
      END IF;
    END $$
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS budgets (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       VARCHAR(255) NOT NULL REFERENCES users(id),
      business_id   UUID,
      category      VARCHAR(50) NOT NULL,
      limit_amount  NUMERIC(18,6) NOT NULL,
      currency      currency_type NOT NULL DEFAULT 'MXN',
      period        budget_period NOT NULL DEFAULT 'monthly',
      is_active     BOOLEAN NOT NULL DEFAULT true,
      notes         TEXT,
      created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✅ Neon migrado");
}

async function migrateLocal() {
  if (!LOCAL_URL) { console.log("⚠  LOCAL_DATABASE_URL no definido, saltando local"); return; }
  const pool = new Pool({ connectionString: LOCAL_URL });
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_period') THEN
        CREATE TYPE budget_period AS ENUM ('weekly','monthly','yearly');
      END IF;
    END $$;
    CREATE TABLE IF NOT EXISTS budgets (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id       VARCHAR(255) NOT NULL REFERENCES users(id),
      business_id   UUID,
      category      VARCHAR(50) NOT NULL,
      limit_amount  NUMERIC(18,6) NOT NULL,
      currency      currency_type NOT NULL DEFAULT 'MXN',
      period        budget_period NOT NULL DEFAULT 'monthly',
      is_active     BOOLEAN NOT NULL DEFAULT true,
      notes         TEXT,
      created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  await pool.end();
  console.log("✅ Local migrado");
}

async function main() {
  const results = await Promise.allSettled([migrateNeon(), migrateLocal()]);
  for (const r of results) {
    if (r.status === "rejected") console.error("❌", r.reason);
  }
}

main();
