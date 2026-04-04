import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { mktCampaigns, mktStrategies, mktCopies, users } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1),
  strategyId: z.string().uuid().nullish(),
  copyId: z.string().uuid().nullish(),
  assignedTo: z.string().nullish(),
  scheduledAt: z.string().nullish(),
  status: z.enum(["draft", "queued", "running", "completed", "paused", "failed"]).optional(),
  notes: z.string().nullish(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const campaigns = await db
    .select()
    .from(mktCampaigns)
    .orderBy(desc(mktCampaigns.createdAt));

  if (!campaigns.length) return NextResponse.json([]);

  // Enriquecer con strategy y copy names
  const strategyIds = campaigns.map((c) => c.strategyId).filter(Boolean) as string[];
  const copyIds = campaigns.map((c) => c.copyId).filter(Boolean) as string[];
  const workerIds = campaigns.map((c) => c.assignedTo).filter(Boolean) as string[];

  const [strategies, copies, workers] = await Promise.all([
    strategyIds.length
      ? db.select({ id: mktStrategies.id, title: mktStrategies.title, targetNiche: mktStrategies.targetNiche, targetCity: mktStrategies.targetCity })
          .from(mktStrategies).where(inArray(mktStrategies.id, strategyIds))
      : Promise.resolve([]),
    copyIds.length
      ? db.select({ id: mktCopies.id, title: mktCopies.title, type: mktCopies.type, abVariant: mktCopies.abVariant })
          .from(mktCopies).where(inArray(mktCopies.id, copyIds))
      : Promise.resolve([]),
    workerIds.length
      ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, workerIds))
      : Promise.resolve([]),
  ]);

  const strategyMap = Object.fromEntries(strategies.map((s) => [s.id, s]));
  const copyMap = Object.fromEntries(copies.map((c) => [c.id, c]));
  const workerMap = Object.fromEntries(workers.map((w) => [w.id, w]));

  return NextResponse.json(
    campaigns.map((c) => ({
      ...c,
      strategy: c.strategyId ? strategyMap[c.strategyId] ?? null : null,
      copy: c.copyId ? copyMap[c.copyId] ?? null : null,
      worker: c.assignedTo ? workerMap[c.assignedTo] ?? null : null,
    }))
  );
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [campaign] = await db
    .insert(mktCampaigns)
    .values({
      ...parsed.data,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
      createdBy: userId,
    })
    .returning();

  return NextResponse.json(campaign, { status: 201 });
}
