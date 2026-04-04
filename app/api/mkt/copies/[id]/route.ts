import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktCopies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateMktApiKey, unauthorizedResponse } from "@/lib/mkt-auth";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

const patchSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().min(1).optional(),
  type: z.enum(["whatsapp_msg", "email_subject", "email_body", "ig_dm", "script", "cta", "other"]).optional(),
  status: z.enum(["draft", "review", "approved", "active", "archived"]).optional(),
  abVariant: z.string().max(1).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
  framework: z.enum(["AIDA", "PAS", "social_proof", "FOMO", "custom"]).nullable().optional(),
  tone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKeyValid = validateMktApiKey(req);
  if (!apiKeyValid) {
    const { userId } = await auth();
    if (!userId) return unauthorizedResponse();
  }

  const { id } = await params;
  const [copy] = await db.select().from(mktCopies).where(eq(mktCopies.id, id));
  if (!copy) return NextResponse.json({ error: "Copy no encontrado" }, { status: 404 });

  return NextResponse.json(copy);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db
    .update(mktCopies)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(mktCopies.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Copy no encontrado" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.delete(mktCopies).where(eq(mktCopies.id, id));
  return NextResponse.json({ ok: true });
}
