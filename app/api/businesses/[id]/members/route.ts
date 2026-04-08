import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { businesses, businessMembers, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["owner", "partner", "viewer"]).optional(),
});

async function isMemberOrOwner(businessId: string, userId: string) {
  const [biz] = await db.select({ ownerId: businesses.ownerId }).from(businesses).where(eq(businesses.id, businessId));
  if (!biz) return false;
  if (biz.ownerId === userId) return true;
  const [member] = await db
    .select({ id: businessMembers.id })
    .from(businessMembers)
    .where(and(eq(businessMembers.businessId, businessId), eq(businessMembers.userId, userId)));
  return !!member;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!await isMemberOrOwner(id, userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const members = await db
    .select({
      id: businessMembers.id,
      businessId: businessMembers.businessId,
      userId: businessMembers.userId,
      role: businessMembers.role,
      joinedAt: businessMembers.joinedAt,
      userName: users.name,
      userEmail: users.email,
      userImage: users.imageUrl,
    })
    .from(businessMembers)
    .leftJoin(users, eq(businessMembers.userId, users.id))
    .where(eq(businessMembers.businessId, id));

  return NextResponse.json(members);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Only owner or owner-role members can add members
  const [biz] = await db.select({ ownerId: businesses.ownerId }).from(businesses).where(eq(businesses.id, id));
  if (!biz) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (biz.ownerId !== userId) {
    const [member] = await db
      .select({ role: businessMembers.role })
      .from(businessMembers)
      .where(and(eq(businessMembers.businessId, id), eq(businessMembers.userId, userId)));
    if (member?.role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Can't add owner as member
  if (parsed.data.userId === biz.ownerId) {
    return NextResponse.json({ error: "Owner is already part of the business" }, { status: 400 });
  }

  const [newMember] = await db
    .insert(businessMembers)
    .values({
      businessId: id,
      userId: parsed.data.userId,
      role: parsed.data.role ?? "viewer",
    })
    .onConflictDoNothing()
    .returning();

  return NextResponse.json(newMember, { status: 201 });
}
