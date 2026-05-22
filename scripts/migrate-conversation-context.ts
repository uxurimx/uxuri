import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("Adding conversation_context column to job_postings...");
  await sql`
    ALTER TABLE job_postings
    ADD COLUMN IF NOT EXISTS conversation_context text
  `;
  console.log("✓ Done");
}

main().catch(console.error);
