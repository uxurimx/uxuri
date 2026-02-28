import { neon } from "@neondatabase/serverless";

process.loadEnvFile(".env.local");

const sql = neon(process.env.DATABASE_URL);

console.log("Ejecutando migración...");

// 1. Quitar el default que referencia al enum
await sql`ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`;
console.log("✓ Default del enum eliminado");

// 2. Cambiar tipo a varchar
await sql`ALTER TABLE "users" ALTER COLUMN "role" TYPE varchar(100) USING "role"::text`;
console.log("✓ Columna role convertida a varchar");

// 3. Restaurar el default como string normal
await sql`ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'client'`;
console.log("✓ Default restaurado como string");

// 4. Eliminar el tipo enum (CASCADE por si queda alguna dependencia)
await sql`DROP TYPE IF EXISTS "role" CASCADE`;
console.log("✓ Tipo enum eliminado");

// 5. Crear tabla roles
await sql`
  CREATE TABLE IF NOT EXISTS "roles" (
    "id" uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    "name" varchar(100) UNIQUE NOT NULL,
    "label" varchar(100) NOT NULL,
    "permissions" text[] NOT NULL DEFAULT '{}',
    "is_default" boolean NOT NULL DEFAULT false,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
  )
`;
console.log("✓ Tabla roles creada");

console.log("\nMigración completada.");
