import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { taskActivity } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const events = await db
    .select()
    .from(taskActivity)
    .where(eq(taskActivity.taskId, id))
    .orderBy(asc(taskActivity.createdAt));

  return NextResponse.json(events);
}
