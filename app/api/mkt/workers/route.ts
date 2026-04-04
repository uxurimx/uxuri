import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktWorkers } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { validateMktApiKey } from "@/lib/mkt-auth";

export async function GET(req: Request) {
  const apiKeyValid = validateMktApiKey(req);
  if (!apiKeyValid) {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Marcar offline a workers sin heartbeat en los últimos 90s
  await db.execute(
    sql`UPDATE mkt_workers SET status = 'offline'
        WHERE last_heartbeat < NOW() - INTERVAL '90 seconds'
          AND status != 'offline'`
  );

  const workers = await db
    .select()
    .from(mktWorkers)
    .orderBy(desc(mktWorkers.lastHeartbeat));

  return NextResponse.json(workers);
}
