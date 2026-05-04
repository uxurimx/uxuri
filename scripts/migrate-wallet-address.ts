import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import { randomBytes } from "crypto";

dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function genUnique(): Promise<string> {
  for (;;) {
    const addr = "uxuri-" + randomBytes(4).toString("hex");
    const exists = await sql`SELECT 1 FROM accounts WHERE wallet_address = ${addr}`;
    if (exists.length === 0) return addr;
  }
}

async function main() {
  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS wallet_address varchar(20) UNIQUE`;
  console.log("✓ Column wallet_address added");

  const rows = await sql`SELECT id FROM accounts WHERE wallet_address IS NULL`;
  console.log(`Generating addresses for ${rows.length} account(s)...`);

  for (const row of rows) {
    const addr = await genUnique();
    await sql`UPDATE accounts SET wallet_address = ${addr} WHERE id = ${row.id as string}`;
    console.log(`  ${row.id as string} → ${addr}`);
  }

  console.log("✓ Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });
