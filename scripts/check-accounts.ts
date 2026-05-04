import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);
async function main() {
  const rows = await sql`
    SELECT id, name, type, user_id, business_id, wallet_address
    FROM accounts ORDER BY name
  `;
  for (const r of rows) console.log(`${r.name} (${r.type}) | ${r.id} | wallet: ${r.wallet_address}`);
}
main();
