import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { taskCategories } from "@/db/schema";
import { eq, or, isNull, asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

// Categorías sistema pre-cargadas (se insertan lazy al primer GET)
const SYSTEM_CATEGORIES = [
  { name: "Estrategia",    color: "#6366f1", icon: "🎯", sortOrder: 0 },
  { name: "Seguridad",     color: "#ef4444", icon: "🔒", sortOrder: 1 },
  { name: "Productividad", color: "#f59e0b", icon: "⚡", sortOrder: 2 },
  { name: "Ingresos",      color: "#10b981", icon: "💰", sortOrder: 3 },
  { name: "Creativo",      color: "#ec4899", icon: "🎨", sortOrder: 4 },
  { name: "Admin",         color: "#64748b", icon: "📋", sortOrder: 5 },
  { name: "Aprendizaje",   color: "#8b5cf6", icon: "📚", sortOrder: 6 },
  { name: "Operaciones",   color: "#0ea5e9", icon: "⚙️", sortOrder: 7 },
  { name: "Personas",      color: "#f97316", icon: "👥", sortOrder: 8 },
];

async function ensureSystemCategories() {
  const existing = await db
    .select({ id: taskCategories.id })
    .from(taskCategories)
    .where(eq(taskCategories.isSystem, true))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(taskCategories).values(
      SYSTEM_CATEGORIES.map((c) => ({ ...c, isSystem: true, createdBy: null }))
    );
  }
}

// GET /api/categories — sistema (no ocultas) + propias del usuario
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await ensureSystemCategories();

  const rows = await db
    .select()
    .from(taskCategories)
    .where(
      or(
        eq(taskCategories.isSystem, true),
        eq(taskCategories.createdBy, userId),
      )
    )
    .orderBy(asc(taskCategories.sortOrder), asc(taskCategories.createdAt));

  return NextResponse.json(rows);
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.string().max(10).optional().default("📌"),
});

// POST /api/categories — crea categoría de usuario
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [created] = await db
    .insert(taskCategories)
    .values({ ...parsed.data, isSystem: false, createdBy: userId })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
