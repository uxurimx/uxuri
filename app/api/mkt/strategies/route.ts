import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { mktStrategies, mktCampaigns } from "@/db/schema";
import { eq, count, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullish(),
  productOffered: z.string().nullish(),
  targetNiche: z.string().nullish(),
  targetCity: z.string().nullish(),
  targetCountry: z.string().nullish(),
  channel: z.enum(["whatsapp", "email", "ig_dm", "whatsapp_email", "sms", "other"]).optional(),
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
  notes: z.string().nullish(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [strategies, campaignCounts] = await Promise.all([
    db.select().from(mktStrategies).orderBy(desc(mktStrategies.createdAt)),
    db.select({ strategyId: mktCampaigns.strategyId, total: count() })
      .from(mktCampaigns)
      .groupBy(mktCampaigns.strategyId),
  ]);

  const countMap = Object.fromEntries(
    campaignCounts.map((c) => [c.strategyId, c.total])
  );

  return NextResponse.json(
    strategies.map((s) => ({ ...s, campaignCount: countMap[s.id] ?? 0 }))
  );
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [strategy] = await db
    .insert(mktStrategies)
    .values({ ...parsed.data, createdBy: userId })
    .returning();

  return NextResponse.json(strategy, { status: 201 });
}
