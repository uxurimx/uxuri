import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { businesses, businessMembers, projects, clients } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["saas", "agency", "product", "service", "household", "personal"]).optional(),
  description: z.string().optional().nullable(),
  logo: z.string().max(10).optional(),
  color: z.string().max(20).optional(),
  status: z.enum(["active", "paused", "archived"]).optional(),
  website: z.string().optional().nullable(),
  linkedProjectId: z.string().uuid().optional().nullable(),
});

async function canManage(businessId: string, userId: string) {
  const [biz] = await db.select({ ownerId: businesses.ownerId }).from(businesses).where(eq(businesses.id, businessId));
  if (!biz) return { allowed: false, isOwner: false };
  if (biz.ownerId === userId) return { allowed: true, isOwner: true };
  const [member] = await db
    .select({ role: businessMembers.role })
    .from(businessMembers)
    .where(eq(businessMembers.businessId, businessId));
  return { allowed: member?.role === "owner", isOwner: false };
}

async function canView(businessId: string, userId: string) {
  const [biz] = await db.select({ ownerId: businesses.ownerId }).from(businesses).where(eq(businesses.id, businessId));
  if (!biz) return false;
  if (biz.ownerId === userId) return true;
  const [member] = await db
    .select({ id: businessMembers.id })
    .from(businessMembers)
    .where(eq(businessMembers.businessId, businessId));
  return !!member;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!await canView(id, userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [biz] = await db.select().from(businesses).where(eq(businesses.id, id));
  if (!biz) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const members = await db
    .select()
    .from(businessMembers)
    .where(eq(businessMembers.businessId, id));

  return NextResponse.json({ ...biz, members });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { allowed } = await canManage(id, userId);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db
    .update(businesses)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(businesses.id, id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { isOwner } = await canManage(id, userId);
  if (!isOwner) return NextResponse.json({ error: "Only the owner can delete" }, { status: 403 });

  // Unlink projects and clients before deleting
  await db.update(projects).set({ businessId: null }).where(eq(projects.businessId, id));
  await db.update(clients).set({ businessId: null }).where(eq(clients.businessId, id));
  await db.delete(businesses).where(eq(businesses.id, id));

  return NextResponse.json({ success: true });
}
