import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { businesses, businessMembers } from "@/db/schema";
import { eq, or, inArray, count, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUser } from "@/lib/ensure-user";

const createSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["saas", "agency", "product", "service", "household", "personal"]).optional(),
  description: z.string().optional(),
  logo: z.string().max(10).optional(),
  color: z.string().max(20).optional(),
  status: z.enum(["active", "paused", "archived"]).optional(),
  website: z.string().optional(),
  linkedProjectId: z.string().uuid().optional(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Business IDs where user is a member (not owner)
  const memberOf = await db
    .select({ businessId: businessMembers.businessId })
    .from(businessMembers)
    .where(eq(businessMembers.userId, userId));
  const memberIds = memberOf.map((r) => r.businessId);

  const whereClause =
    memberIds.length > 0
      ? or(eq(businesses.ownerId, userId), inArray(businesses.id, memberIds))
      : eq(businesses.ownerId, userId);

  const result = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      type: businesses.type,
      description: businesses.description,
      logo: businesses.logo,
      color: businesses.color,
      status: businesses.status,
      website: businesses.website,
      linkedProjectId: businesses.linkedProjectId,
      ownerId: businesses.ownerId,
      createdAt: businesses.createdAt,
      updatedAt: businesses.updatedAt,
      memberCount: count(businessMembers.id),
    })
    .from(businesses)
    .leftJoin(businessMembers, eq(businessMembers.businessId, businesses.id))
    .where(whereClause!)
    .groupBy(businesses.id)
    .orderBy(desc(businesses.createdAt));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureUser(userId);

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [business] = await db
    .insert(businesses)
    .values({ ...parsed.data, ownerId: userId })
    .returning();

  return NextResponse.json(business, { status: 201 });
}
