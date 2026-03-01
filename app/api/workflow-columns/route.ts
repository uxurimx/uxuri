import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { workflowColumns } from "@/db/schema";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1),
  color: z.string().default("#94a3b8"),
  sortOrder: z.number().int().optional(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cols = await db.select().from(workflowColumns).orderBy(workflowColumns.sortOrder);
  return NextResponse.json(cols);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [col] = await db
    .insert(workflowColumns)
    .values({ ...parsed.data, createdBy: userId })
    .returning();

  return NextResponse.json(col, { status: 201 });
}
