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
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bill_frequency') THEN
        CREATE TYPE bill_frequency AS ENUM ('weekly','biweekly','monthly','bimonthly','quarterly','yearly','once');
      END IF;
    END $$
  `;
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bill_payment_status') THEN
        CREATE TYPE bill_payment_status AS ENUM ('paid','skipped');
      END IF;
    END $$
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bills (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         VARCHAR(255) NOT NULL REFERENCES users(id),
      account_id      UUID REFERENCES accounts(id),
      business_id     UUID,
      name            VARCHAR(200) NOT NULL,
      amount          NUMERIC(18,6) NOT NULL,
      currency        currency_type NOT NULL DEFAULT 'MXN',
      frequency       bill_frequency NOT NULL DEFAULT 'monthly',
      next_due_date   DATE NOT NULL,
      category        VARCHAR(50),
      is_active       BOOLEAN NOT NULL DEFAULT true,
      notes           TEXT,
      created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS bill_payments (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bill_id         UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
      user_id         VARCHAR(255) NOT NULL REFERENCES users(id),
      paid_date       DATE NOT NULL,
      amount          NUMERIC(18,6) NOT NULL,
      currency        currency_type NOT NULL DEFAULT 'MXN',
      status          bill_payment_status NOT NULL DEFAULT 'paid',
      transaction_id  UUID,
      notes           TEXT,
      created_at      TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✅ Neon migrado");
}

async function migrateLocal() {
  if (!LOCAL_URL) { console.log("⚠  LOCAL_DATABASE_URL no definido, saltando local"); return; }
  const pool = new Pool({ connectionString: LOCAL_URL });
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bill_frequency') THEN
        CREATE TYPE bill_frequency AS ENUM ('weekly','biweekly','monthly','bimonthly','quarterly','yearly','once');
      END IF;
    END $$;
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bill_payment_status') THEN
        CREATE TYPE bill_payment_status AS ENUM ('paid','skipped');
      END IF;
    END $$;
    CREATE TABLE IF NOT EXISTS bills (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id         VARCHAR(255) NOT NULL REFERENCES users(id),
      account_id      UUID REFERENCES accounts(id),
      business_id     UUID,
      name            VARCHAR(200) NOT NULL,
      amount          NUMERIC(18,6) NOT NULL,
      currency        currency_type NOT NULL DEFAULT 'MXN',
      frequency       bill_frequency NOT NULL DEFAULT 'monthly',
      next_due_date   DATE NOT NULL,
      category        VARCHAR(50),
      is_active       BOOLEAN NOT NULL DEFAULT true,
      notes           TEXT,
      created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS bill_payments (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bill_id         UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
      user_id         VARCHAR(255) NOT NULL REFERENCES users(id),
      paid_date       DATE NOT NULL,
      amount          NUMERIC(18,6) NOT NULL,
      currency        currency_type NOT NULL DEFAULT 'MXN',
      status          bill_payment_status NOT NULL DEFAULT 'paid',
      transaction_id  UUID,
      notes           TEXT,
      created_at      TIMESTAMP NOT NULL DEFAULT NOW()
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
