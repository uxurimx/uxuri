import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { cyclePresets } from "@/db/schema";
import { eq, or, isNull, asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

// Presets sistema por defecto
const SYSTEM_PRESETS = [
  { label: "5 min",  minutes: 5,    sortOrder: 0 },
  { label: "30 min", minutes: 30,   sortOrder: 1 },
  { label: "1 hora", minutes: 60,   sortOrder: 2 },
  { label: "4 hrs",  minutes: 240,  sortOrder: 3 },
  { label: "1 día",  minutes: 1440, sortOrder: 4 },
  { label: "3 días", minutes: 4320, sortOrder: 5 },
  { label: "1 sem",  minutes: 10080,sortOrder: 6 },
];

async function ensureSystemPresets() {
  const existing = await db
    .select({ id: cyclePresets.id })
    .from(cyclePresets)
    .where(eq(cyclePresets.isSystem, true))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(cyclePresets).values(
      SYSTEM_PRESETS.map((p) => ({ ...p, isSystem: true, userId: null }))
    );
  }
}

// GET /api/cycle-presets — sistema (no ocultos) + propios del usuario
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureSystemPresets();

  const rows = await db
    .select()
    .from(cyclePresets)
    .where(
      or(
        eq(cyclePresets.isSystem, true),
        eq(cyclePresets.userId, userId),
      )
    )
    .orderBy(asc(cyclePresets.sortOrder), asc(cyclePresets.createdAt));

  return NextResponse.json(rows);
}

const createSchema = z.object({
  label: z.string().min(1).max(50),
  minutes: z.number().int().min(1),
});

// POST /api/cycle-presets
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [created] = await db
    .insert(cyclePresets)
    .values({ ...parsed.data, isSystem: false, userId })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
