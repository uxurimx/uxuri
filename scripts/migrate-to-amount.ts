import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);
async function main() {
  await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS to_amount numeric(18,6)`;
  console.log("✓ Column to_amount added to transactions");
}
main().catch((e) => { console.error(e); process.exit(1); });
