/**
 * Migration: Shopping Lists (Fase 1)
 * Run: npx tsx scripts/migrate-shopping-lists.ts
 */
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL missing in .env.local");

const client = neon(DATABASE_URL);
const db = drizzle(client);

async function run() {
  console.log("→ Creating enums...");

  await db.execute(sql.raw(`
    DO $$ BEGIN
      CREATE TYPE shopping_list_status AS ENUM ('active', 'done', 'archived');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `));

  await db.execute(sql.raw(`
    DO $$ BEGIN
      CREATE TYPE shopping_item_category AS ENUM (
        'frutas_verduras', 'carnes_mariscos', 'lacteos_huevos',
        'panaderia', 'bebidas', 'abarrotes', 'limpieza',
        'higiene', 'congelados', 'farmacia', 'otro'
      );
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `));

  console.log("→ Creating shopping_lists table...");
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS shopping_lists (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      VARCHAR(255) NOT NULL REFERENCES users(id),
      business_id  UUID,
      name         VARCHAR(200) NOT NULL,
      week_start   DATE,
      status       shopping_list_status NOT NULL DEFAULT 'active',
      notes        TEXT,
      created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `));

  console.log("→ Creating shopping_items table...");
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS shopping_items (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      list_id         UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
      name            VARCHAR(200) NOT NULL,
      category        shopping_item_category NOT NULL DEFAULT 'otro',
      quantity        VARCHAR(50),
      estimated_price NUMERIC(10, 2),
      notes           TEXT,
      is_done         BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order      INTEGER NOT NULL DEFAULT 0,
      created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `));

  console.log("→ Creating indexes...");
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_shopping_lists_user ON shopping_lists(user_id);`));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_shopping_lists_business ON shopping_lists(business_id);`));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS idx_shopping_items_list ON shopping_items(list_id);`));

  console.log("✓ Migration complete.");
}

run().catch((err) => { console.error(err); process.exit(1); });
