/**
 * migrate-nomina-type.ts — Agrega el tipo "nomina" al enum account_type
 * Run: npx tsx scripts/migrate-nomina-type.ts
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

async function main() {
  console.log("→ Agregando tipo 'nomina' al enum account_type...");
  // IF NOT EXISTS requiere Postgres 9.6+; Neon lo soporta
  await exec(`ALTER TYPE account_type ADD VALUE IF NOT EXISTS 'nomina'`);
  console.log("✓ Listo. El enum account_type ahora incluye 'nomina'.");
}

main().catch((e) => { console.error(e); process.exit(1); });
