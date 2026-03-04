import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { contextEntries, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  entityType: z.enum(["client", "project", "objective"]),
  entityId: z.string().uuid(),
  content: z.string().min(1),
});

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType") as "client" | "project" | "objective" | null;
  const entityId = url.searchParams.get("entityId");

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType and entityId required" }, { status: 400 });
  }

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
