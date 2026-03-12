import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { contextEntries, users, clients, projects, objectives } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccess } from "@/lib/access";

const createSchema = z.object({
  entityType: z.enum(["client", "project", "objective"]),
  entityId: z.string().uuid(),
  content: z.string().min(1),
});

async function checkEntityAccess(
  userId: string,
  entityType: "client" | "project" | "objective",
  entityId: string,
  minPermission: "view" | "edit" = "view"
): Promise<{ ok: true } | { ok: false; status: 403 | 404 }> {
  let ownerId: string | null = null;

  if (entityType === "client") {
    const [r] = await db.select({ createdBy: clients.createdBy }).from(clients).where(eq(clients.id, entityId));
    if (!r) return { ok: false, status: 404 };
    ownerId = r.createdBy;
  } else if (entityType === "project") {
    const [r] = await db.select({ createdBy: projects.createdBy }).from(projects).where(eq(projects.id, entityId));
    if (!r) return { ok: false, status: 404 };
    ownerId = r.createdBy;
  } else {
    const [r] = await db.select({ createdBy: objectives.createdBy }).from(objectives).where(eq(objectives.id, entityId));
    if (!r) return { ok: false, status: 404 };
    ownerId = r.createdBy;
  }

  const allowed = await canAccess(userId, entityType, entityId, ownerId, minPermission);
  if (!allowed) return { ok: false, status: 403 };
  return { ok: true };
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType") as "client" | "project" | "objective" | null;
  const entityId = url.searchParams.get("entityId");

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType and entityId required" }, { status: 400 });
  }

  const access = await checkEntityAccess(userId, entityType, entityId, "view");
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: access.status });

  const rows = await db
    .select()
    .from(contextEntries)
    .where(
      and(
        eq(contextEntries.entityType, entityType),
        eq(contextEntries.entityId, entityId)
      )
    )
    .orderBy(contextEntries.createdAt);

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

  const { entityType, entityId } = parsed.data;
  const access = await checkEntityAccess(userId, entityType, entityId, "view");
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: access.status });

  // Get user name
  const [user] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
  const userName = user?.name ?? "Usuario";

  const [entry] = await db
    .insert(contextEntries)
    .values({
      ...parsed.data,
      userId,
      userName,
    })
    .returning();

  return NextResponse.json(entry, { status: 201 });
}
