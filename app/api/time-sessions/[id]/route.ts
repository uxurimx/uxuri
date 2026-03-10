import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { timeSessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  action: z.enum(["pause", "resume", "stop"]),
  elapsedSeconds: z.number().int().min(0),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { action, elapsedSeconds } = parsed.data;

  const statusMap = { pause: "paused", resume: "running", stop: "stopped" } as const;
  const newStatus = statusMap[action];

  // If resuming, pause any other running sessions first
  if (action === "resume") {
    await db
      .update(timeSessions)
      .set({ status: "paused" })
      .where(and(eq(timeSessions.userId, userId), eq(timeSessions.status, "running")));
  }

  const [updated] = await db
    .update(timeSessions)
    .set({
      status: newStatus,
      elapsedSeconds,
      ...(action === "stop" ? { endedAt: new Date() } : {}),
    })
    .where(and(eq(timeSessions.id, id), eq(timeSessions.userId, userId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db
    .delete(timeSessions)
    .where(and(eq(timeSessions.id, id), eq(timeSessions.userId, userId)));

  return NextResponse.json({ success: true });
}
