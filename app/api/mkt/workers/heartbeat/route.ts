import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktWorkers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateMktApiKey, unauthorizedResponse } from "@/lib/mkt-auth";
import { z } from "zod";

const schema = z.object({
  workerId:          z.string(),
  hostname:          z.string().nullish(),
  workerType:        z.enum(["laptop", "rpi", "bbb", "aws", "other"]).nullish(),
  capabilities:      z.array(z.string()).nullish(),
  currentCampaignId: z.string().uuid().nullish(),
  tunnelUrl:         z.string().url().nullish(),
});

export async function POST(req: Request) {
  if (!validateMktApiKey(req)) return unauthorizedResponse();

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { workerId, hostname, workerType, capabilities,
          currentCampaignId, tunnelUrl } = parsed.data;

  const [worker] = await db
    .insert(mktWorkers)
    .values({
      workerId,
      hostname:          hostname ?? null,
      workerType:        workerType ?? "laptop",
      capabilities:      capabilities ?? [],
      currentCampaignId: currentCampaignId ?? null,
      tunnelUrl:         tunnelUrl ?? null,
      status:            currentCampaignId ? "busy" : "online",
      lastHeartbeat:     new Date(),
    })
    .onConflictDoUpdate({
      target: mktWorkers.workerId,
      set: {
        hostname:          hostname ?? null,
        workerType:        workerType ?? "laptop",
        capabilities:      capabilities ?? [],
        currentCampaignId: currentCampaignId ?? null,
        tunnelUrl:         tunnelUrl ?? null,
        status:            currentCampaignId ? "busy" : "online",
        lastHeartbeat:     new Date(),
      },
    })
    .returning();

  return NextResponse.json(worker);
}
