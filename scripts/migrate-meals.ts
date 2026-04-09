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
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meal_time') THEN
        CREATE TYPE meal_time AS ENUM ('desayuno','comida','cena','snack');
      END IF;
    END $$
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS meal_plans (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     VARCHAR(255) NOT NULL REFERENCES users(id),
      week_start  DATE NOT NULL,
      notes       TEXT,
      created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT meal_plan_week_unique UNIQUE (user_id, week_start)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS meal_entries (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_id         UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
      user_id         VARCHAR(255) NOT NULL REFERENCES users(id),
      day_of_week     INTEGER NOT NULL,
      meal_time       meal_time NOT NULL,
      name            VARCHAR(200) NOT NULL,
      estimated_cost  NUMERIC(10,2),
      notes           TEXT,
      created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✅ Neon migrado");
}

async function migrateLocal() {
  if (!LOCAL_URL) { console.log("⚠  LOCAL_DATABASE_URL no definido, saltando local"); return; }
  const pool = new Pool({ connectionString: LOCAL_URL });
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meal_time') THEN
        CREATE TYPE meal_time AS ENUM ('desayuno','comida','cena','snack');
      END IF;
    END $$;
    CREATE TABLE IF NOT EXISTS meal_plans (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     VARCHAR(255) NOT NULL REFERENCES users(id),
      week_start  DATE NOT NULL,
      notes       TEXT,
      created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT meal_plan_week_unique UNIQUE (user_id, week_start)
    );
    CREATE TABLE IF NOT EXISTS meal_entries (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      plan_id         UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
      user_id         VARCHAR(255) NOT NULL REFERENCES users(id),
      day_of_week     INTEGER NOT NULL,
      meal_time       meal_time NOT NULL,
      name            VARCHAR(200) NOT NULL,
      estimated_cost  NUMERIC(10,2),
      notes           TEXT,
      created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
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
