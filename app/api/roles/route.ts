import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { roles } from "@/db/schema";
import { requireAccess } from "@/lib/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

const createRoleSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9_-]+$/, "Solo minúsculas, números, guiones"),
  label: z.string().min(1),
  permissions: z.array(z.string()),
  isDefault: z.boolean().optional(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await db.select().from(roles).orderBy(roles.createdAt);
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  await requireAccess("/users");

  const body = await req.json();
  const parsed = createRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Si se marca como default, quitar default de los demás
  if (parsed.data.isDefault) {
    await db.update(roles).set({ isDefault: false });
  }

  const [role] = await db.insert(roles).values({
    name: parsed.data.name,
    label: parsed.data.label,
    permissions: parsed.data.permissions,
    isDefault: parsed.data.isDefault ?? false,
  }).returning();

  return NextResponse.json(role, { status: 201 });
}
