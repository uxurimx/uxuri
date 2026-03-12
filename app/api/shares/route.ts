import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { shares, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  resourceType: z.enum(["objective", "project", "client", "task"]),
  resourceId: z.string().uuid(),
  sharedWithId: z.string(),
  permission: z.enum(["view", "edit"]).default("view"),
});

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const resourceType = searchParams.get("resourceType") as "objective" | "project" | "client" | "task" | null;
  const resourceId = searchParams.get("resourceId");

  if (!resourceType || !resourceId) {
    return NextResponse.json({ error: "resourceType and resourceId required" }, { status: 400 });
  }

  // Only the owner can see who has access
  const rows = await db
    .select({
      id: shares.id,
      sharedWithId: shares.sharedWithId,
      permission: shares.permission,
      createdAt: shares.createdAt,
      sharedWithName: users.name,
      sharedWithEmail: users.email,
      sharedWithImage: users.imageUrl,
    })
    .from(shares)
    .leftJoin(users, eq(shares.sharedWithId, users.id))
    .where(
      and(
        eq(shares.resourceType, resourceType),
        eq(shares.resourceId, resourceId),
        eq(shares.ownerId, userId),
      )
    );

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { resourceType, resourceId, sharedWithId, permission } = parsed.data;

  if (sharedWithId === userId) {
    return NextResponse.json({ error: "No puedes compartir contigo mismo" }, { status: 400 });
  }

  // Upsert: if already shared, update permission
  const [existing] = await db
    .select({ id: shares.id })
    .from(shares)
    .where(
      and(
        eq(shares.resourceType, resourceType),
        eq(shares.resourceId, resourceId),
        eq(shares.sharedWithId, sharedWithId),
      )
    );

  if (existing) {
    const [updated] = await db
      .update(shares)
      .set({ permission })
      .where(eq(shares.id, existing.id))
      .returning();
    return NextResponse.json(updated);
  }

  const [row] = await db
    .insert(shares)
    .values({ resourceType, resourceId, ownerId: userId, sharedWithId, permission })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
