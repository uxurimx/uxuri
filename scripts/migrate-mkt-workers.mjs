import { neon } from "@neondatabase/serverless";

process.loadEnvFile(".env.local");

const sql = neon(process.env.DATABASE_URL);

console.log("Migrando mkt_workers...\n");

// Crear enums con DO $$ ... $$ para evitar error si ya existen
await sql`
  DO $$ BEGIN
    CREATE TYPE mkt_worker_type AS ENUM('laptop','rpi','bbb','aws','other');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$
`;
console.log("✓ mkt_worker_type enum");

await sql`
  DO $$ BEGIN
    CREATE TYPE mkt_worker_status AS ENUM('online','busy','offline');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$
`;
console.log("✓ mkt_worker_status enum");

// Crear tabla mkt_workers
await sql`
  CREATE TABLE IF NOT EXISTS mkt_workers (
    id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id          varchar(128) UNIQUE NOT NULL,
    hostname           varchar(255),
    worker_type        mkt_worker_type DEFAULT 'laptop',
    status             mkt_worker_status NOT NULL DEFAULT 'online',
    capabilities       jsonb DEFAULT '[]',
    current_campaign_id uuid,
    tunnel_url         varchar(512),
    last_heartbeat     timestamp NOT NULL DEFAULT now(),
    registered_at      timestamp NOT NULL DEFAULT now()
  )
`;
console.log("✓ tabla mkt_workers");

// Verificar columnas de mkt_campaigns
const cols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'mkt_campaigns'
    AND column_name IN ('worker_id','claimed_at','failed_count','scraped_count','error_message')
`;
const existing = new Set(cols.map(r => r.column_name));

if (!existing.has("worker_id")) {
  await sql`ALTER TABLE mkt_campaigns ADD COLUMN worker_id varchar(128)`;
  console.log("✓ mkt_campaigns.worker_id añadido");
} else {
  console.log("· mkt_campaigns.worker_id ya existe");
}

if (!existing.has("claimed_at")) {
  await sql`ALTER TABLE mkt_campaigns ADD COLUMN claimed_at timestamp`;
  console.log("✓ mkt_campaigns.claimed_at añadido");
} else {
  console.log("· mkt_campaigns.claimed_at ya existe");
}

if (!existing.has("failed_count")) {
  await sql`ALTER TABLE mkt_campaigns ADD COLUMN failed_count integer NOT NULL DEFAULT 0`;
  console.log("✓ mkt_campaigns.failed_count añadido");
} else {
  console.log("· mkt_campaigns.failed_count ya existe");
}

if (!existing.has("scraped_count")) {
  await sql`ALTER TABLE mkt_campaigns ADD COLUMN scraped_count integer NOT NULL DEFAULT 0`;
  console.log("✓ mkt_campaigns.scraped_count añadido");
} else {
  console.log("· mkt_campaigns.scraped_count ya existe");
}

if (!existing.has("error_message")) {
  await sql`ALTER TABLE mkt_campaigns ADD COLUMN error_message text`;
  console.log("✓ mkt_campaigns.error_message añadido");
} else {
  console.log("· mkt_campaigns.error_message ya existe");
}

// Verificar que los nuevos valores del enum de campaña existen
await sql`
  DO $$ BEGIN
    ALTER TYPE mkt_campaign_status ADD VALUE IF NOT EXISTS 'claimed';
  EXCEPTION WHEN others THEN NULL;
  END $$
`;
await sql`
  DO $$ BEGIN
    ALTER TYPE mkt_campaign_status ADD VALUE IF NOT EXISTS 'scraping';
  EXCEPTION WHEN others THEN NULL;
  END $$
`;
console.log("✓ mkt_campaign_status enum actualizado (claimed, scraping)");

// Verificar estructura final
const workerCols = await sql`
  SELECT column_name, data_type, udt_name
  FROM information_schema.columns
  WHERE table_name = 'mkt_workers'
  ORDER BY ordinal_position
`;
console.log("\n=== mkt_workers columns ===");
workerCols.forEach(c => console.log(`  ${c.column_name}: ${c.udt_name}`));

console.log("\n✅ Migración completa.");
