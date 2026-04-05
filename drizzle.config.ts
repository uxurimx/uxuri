import { defineConfig } from "drizzle-kit";

// drizzle-kit no carga .env.local automáticamente (eso es exclusivo de Next.js)
try {
  process.loadEnvFile(".env.local");
} catch {}

const useLocal = process.env.USE_LOCAL_DB === "true";

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: useLocal
      ? process.env.LOCAL_DATABASE_URL!
      : process.env.DATABASE_URL!,
  },
});
