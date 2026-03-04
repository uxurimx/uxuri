import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { planningSessions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1).optional(),
  contextType: z.enum(["blank", "task", "project", "objective", "client"]).optional(),
  contextId: z.string().uuid().optional().nullable(),
  contextSnapshot: z.record(z.unknown()).optional().nullable(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessions = await db
    .select()
    .from(planningSessions)
    .where(eq(planningSessions.createdBy, userId))
    .orderBy(desc(planningSessions.updatedAt));

  return NextResponse.json(sessions);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [session] = await db
    .insert(planningSessions)
    .values({
      title: parsed.data.title ?? "Nueva sesión",
      contextType: parsed.data.contextType ?? "blank",
      contextId: parsed.data.contextId ?? null,
      contextSnapshot: parsed.data.contextSnapshot ?? null,
      createdBy: userId,
    })
    .returning();

  return NextResponse.json(session, { status: 201 });
}
