import { defineConfig } from "drizzle-kit";

// drizzle-kit no carga .env.local automáticamente (eso es exclusivo de Next.js)
try {
  process.loadEnvFile(".env.local");
} catch {}

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
