import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { workflowColumns, tasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [existing] = await db.select().from(workflowColumns).where(eq(workflowColumns.id, id));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdBy && existing.createdBy !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db
    .update(workflowColumns)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(workflowColumns.id, id))
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
  const [existing] = await db.select().from(workflowColumns).where(eq(workflowColumns.id, id));
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.createdBy && existing.createdBy !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Move tasks in this column back to "todo"
  await db
    .update(tasks)
    .set({ customColumnId: null, updatedAt: new Date() })
    .where(eq(tasks.customColumnId, id));

  await db.delete(workflowColumns).where(eq(workflowColumns.id, id));
  return NextResponse.json({ success: true });
}
