import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const itemSchema = z.object({
  id:      z.string(),
  visible: z.boolean(),
  order:   z.number().int(),
});

const bodySchema = z.object({
  layout: z.array(itemSchema),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [user] = await db
    .select({ navLayout: users.navLayout })
    .from(users)
    .where(eq(users.id, userId));

  return NextResponse.json({ layout: user?.navLayout ?? null });
}

export async function PUT(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await db
    .update(users)
    .set({ navLayout: parsed.data.layout, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return NextResponse.json({ ok: true });
}
