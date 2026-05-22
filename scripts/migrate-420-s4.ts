import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("Migrating: adding breath_type to deep_breaths...");
  await sql`ALTER TABLE deep_breaths ADD COLUMN IF NOT EXISTS breath_type VARCHAR(20) DEFAULT 'inhale'`;
  console.log("✓ Done");
}

main().catch((e) => { console.error(e); process.exit(1); });
