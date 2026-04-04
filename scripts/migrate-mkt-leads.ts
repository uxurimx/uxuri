/**
 * Migración SQLite → Neon: importa todos los leads del proyecto mkt
 *
 * Uso:
 *   npx tsx scripts/migrate-mkt-leads.ts [ruta-del-leads.db]
 *
 * Requiere:
 *   npm install better-sqlite3 @types/better-sqlite3 --save-dev
 *
 * La ruta por defecto es /home/dev/Projects/mkt/leads.db
 * Se puede sobreescribir con el primer argumento.
 */

import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { mktLeads } from "../db/schema/mkt-leads";
import { sql } from "drizzle-orm";

const DB_PATH = process.argv[2] ?? "/home/dev/Projects/mkt/leads.db";

interface SQLiteLead {
  id: number;
  name: string | null;
  category: string | null;
  niche: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  menu_url: string | null;
  address: string | null;
  query: string | null;
  rating: number | null;
  reviews: number | null;
  web_source: string | null;
  has_whatsapp: number | null;
  score: number | null;
  social_fb: string | null;
  social_ig: string | null;
  social_data: string | null;
  status: string | null;
  notes: string | null;
  template_used: string | null;
  contacted_at: string | null;
  last_activity: string | null;
  followup_step: number | null;
  next_followup: string | null;
  created_at: string | null;
}

// Mapa de status SQLite → enum PostgreSQL
const statusMap: Record<string, typeof mktLeads.$inferInsert["status"]> = {
  "nuevo":          "nuevo",
  "pendiente":      "pendiente",
  "contactado":     "contactado",
  "interesado":     "interesado",
  "no responde":    "no_responde",
  "sin whatsapp":   "sin_whatsapp",
  "descartado":     "descartado",
  "cerrado":        "cerrado",
};

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌  DATABASE_URL no encontrada en .env.local");
    process.exit(1);
  }

  console.log(`📂  Abriendo SQLite: ${DB_PATH}`);
  const sqlite = new BetterSqlite3(DB_PATH, { readonly: true });

  const leads = sqlite.prepare("SELECT * FROM leads ORDER BY id ASC").all() as SQLiteLead[];
  console.log(`📊  Leads encontrados en SQLite: ${leads.length}`);

  const connection = neon(process.env.DATABASE_URL);
  const db = drizzle(connection);

  let ok = 0;
  let err = 0;
  const BATCH = 50;

  for (let i = 0; i < leads.length; i += BATCH) {
    const batch = leads.slice(i, i + BATCH);

    for (const lead of batch) {
      try {
        let parsedSocialData: Record<string, unknown> | null = null;
        if (lead.social_data) {
          try { parsedSocialData = JSON.parse(lead.social_data); } catch { /* skip */ }
        }

        await db
          .insert(mktLeads)
          .values({
            sourceId: String(lead.id),
            name: lead.name ?? null,
            category: lead.category ?? null,
            niche: lead.niche ?? null,
            city: lead.city ?? null,
            country: lead.country ?? "México",
            phone: lead.phone ?? null,
            email: lead.email ?? null,
            website: lead.website ?? null,
            menuUrl: lead.menu_url ?? null,
            address: lead.address ?? null,
            query: lead.query ?? null,
            rating: lead.rating ?? null,
            reviews: lead.reviews ?? null,
            webSource: lead.web_source ?? null,
            hasWhatsapp: lead.has_whatsapp ?? null,
            score: lead.score ?? null,
            socialFb: lead.social_fb ?? null,
            socialIg: lead.social_ig ?? null,
            socialData: parsedSocialData,
            status: statusMap[lead.status ?? "nuevo"] ?? "nuevo",
            notes: lead.notes ?? null,
            templateUsed: lead.template_used ?? null,
            contactedAt: lead.contacted_at ? new Date(lead.contacted_at) : null,
            lastActivity: lead.last_activity ? new Date(lead.last_activity) : null,
            followupStep: lead.followup_step ?? 0,
            nextFollowup: lead.next_followup ? new Date(lead.next_followup) : null,
            scrapedAt: lead.created_at ? new Date(lead.created_at) : new Date(),
          })
          .onConflictDoUpdate({
            target: mktLeads.sourceId,
            set: {
              status: statusMap[lead.status ?? "nuevo"] ?? "nuevo",
              hasWhatsapp: lead.has_whatsapp ?? null,
              notes: lead.notes ?? null,
              templateUsed: lead.template_used ?? null,
              contactedAt: lead.contacted_at ? new Date(lead.contacted_at) : null,
              lastActivity: lead.last_activity ? new Date(lead.last_activity) : null,
              followupStep: lead.followup_step ?? 0,
              nextFollowup: lead.next_followup ? new Date(lead.next_followup) : null,
              updatedAt: new Date(),
            },
          });

        ok++;
      } catch (e) {
        err++;
        console.error(`  ❌  Lead id=${lead.id}:`, e);
      }
    }

    process.stdout.write(`\r  ✅  ${ok}/${leads.length} importados...`);
  }

  console.log(`\n\n🎉  Migración completada`);
  console.log(`   OK:    ${ok}`);
  console.log(`   Error: ${err}`);

  sqlite.close();
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
