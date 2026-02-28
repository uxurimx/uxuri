import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { ensureUser } from "@/lib/ensure-user";
import { NextResponse } from "next/server";
import { z } from "zod";

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  clientId: z.string().uuid().optional(),
  status: z.enum(["planning", "active", "paused", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await db.select().from(projects).orderBy(projects.createdAt);
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureUser(userId);

  const body = await req.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const [project] = await db.insert(projects).values({
    ...parsed.data,
    clientId: parsed.data.clientId ?? null,
    startDate: parsed.data.startDate || null,
    endDate: parsed.data.endDate || null,
    createdBy: userId,
  }).returning();

  return NextResponse.json(project, { status: 201 });
}
