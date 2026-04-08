import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { businesses, businessMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  role: z.enum(["owner", "partner", "viewer"]),
});

async function isOwnerOfBusiness(businessId: string, userId: string) {
  const [biz] = await db.select({ ownerId: businesses.ownerId }).from(businesses).where(eq(businesses.id, businessId));
  return biz?.ownerId === userId;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, memberId } = await params;
  if (!await isOwnerOfBusiness(id, userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db
    .update(businessMembers)
    .set({ role: parsed.data.role })
    .where(and(eq(businessMembers.id, memberId), eq(businessMembers.businessId, id)))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, memberId } = await params;
  if (!await isOwnerOfBusiness(id, userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db
    .delete(businessMembers)
    .where(and(eq(businessMembers.id, memberId), eq(businessMembers.businessId, id)));

  return NextResponse.json({ success: true });
}
