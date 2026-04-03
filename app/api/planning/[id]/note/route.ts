import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { planningSessions, planningMessages } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ content: z.string().min(1) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [session] = await db
    .select()
    .from(planningSessions)
    .where(and(eq(planningSessions.id, id), eq(planningSessions.createdBy, userId)));

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [message] = await db
    .insert(planningMessages)
    .values({ sessionId: id, role: "user", content: parsed.data.content })
    .returning();

  await db.update(planningSessions).set({ updatedAt: new Date() }).where(eq(planningSessions.id, id));

  return NextResponse.json({ message });
}
