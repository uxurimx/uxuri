import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { Skin } from "@/lib/skins";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [row] = await db
    .select({ activeSkinId: users.activeSkinId, customSkinsData: users.customSkinsData })
    .from(users)
    .where(eq(users.id, userId));

  return NextResponse.json({
    activeSkinId: row?.activeSkinId ?? "default",
    customSkins:  (row?.customSkinsData as Skin[] | null) ?? [],
  });
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { activeSkinId?: string; customSkins?: Skin[] };
  const update: Partial<typeof users.$inferInsert> = {};
  if (body.activeSkinId !== undefined) update.activeSkinId = body.activeSkinId;
  if (body.customSkins  !== undefined) update.customSkinsData = body.customSkins as unknown as typeof users.$inferInsert["customSkinsData"];

  if (Object.keys(update).length > 0) {
    await db.update(users).set(update).where(eq(users.id, userId));
  }
  return NextResponse.json({ ok: true });
}
