import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { objectiveAttachments } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { assertObjectiveAccess } from "@/lib/objective-access";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; aid: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: objectiveId, aid } = await params;
  const access = await assertObjectiveAccess(userId, objectiveId, "edit");
  if (!access.ok) return NextResponse.json({ error: "Forbidden" }, { status: access.status });

  await db
    .delete(objectiveAttachments)
    .where(
      and(eq(objectiveAttachments.id, aid), eq(objectiveAttachments.objectiveId, objectiveId))
    );
  return NextResponse.json({ success: true });
}
