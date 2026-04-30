import { requireAccess } from "@/lib/auth";
import { db } from "@/db";
import { roles } from "@/db/schema";
import { DEFAULT_ROLE_SEEDS } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

export async function POST() {
  await requireAccess("/users");

  const created: string[] = [];

  for (const seed of DEFAULT_ROLE_SEEDS) {
    const [existing] = await db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.name, seed.name));

    if (existing) continue;

    // Si este es el default, quitar default de los demás primero
    if (seed.isDefault) {
      await db.update(roles).set({ isDefault: false });
    }

    await db.insert(roles).values({
      name: seed.name,
      label: seed.label,
      permissions: [...seed.permissions],
      isDefault: seed.isDefault,
    });

    created.push(seed.name);
  }

  return NextResponse.json({ created });
}
