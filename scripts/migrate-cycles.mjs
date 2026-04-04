import { neon } from "@neondatabase/serverless";

process.loadEnvFile(".env.local");
const sql = neon(process.env.DATABASE_URL);

console.log("Migrando ciclos en projects...\n");

await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS cycle_hours  integer`;
console.log("✓ cycle_hours");
await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_cycle_at timestamp`;
console.log("✓ last_cycle_at");
await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS next_cycle_at timestamp`;
console.log("✓ next_cycle_at");
await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS momentum integer NOT NULL DEFAULT 100`;
console.log("✓ momentum");

const cols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'projects'
  AND column_name IN ('cycle_hours','last_cycle_at','next_cycle_at','momentum')
`;
console.log(`\n✅ ${cols.length}/4 columnas de ciclo confirmadas en projects.`);
