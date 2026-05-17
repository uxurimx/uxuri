import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { smokeSessions, smokeCheckins, smokeNotes } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { require420Access, is420Forbidden } from "@/lib/smoke-guard";
import { callAI } from "@/lib/ai-call";

const patchSchema = z.object({
  status: z.enum(["active", "closed"]).optional(),
  creativityRating: z.number().int().min(1).max(10).optional().nullable(),
  relaxRating: z.number().int().min(1).max(10).optional().nullable(),
  focusRating: z.number().int().min(1).max(10).optional().nullable(),
  euphoriaRating: z.number().int().min(1).max(10).optional().nullable(),
  depthRating: z.number().int().min(1).max(10).optional().nullable(),
  moodAfter: z.number().int().min(1).max(10).optional().nullable(),
  overallRating: z.number().int().min(1).max(10).optional().nullable(),
  summary: z.string().optional().nullable(),
  generateAI: z.boolean().optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await require420Access();
  if (is420Forbidden(guard)) return guard;
  const { userId } = guard;
  const { id } = await params;

  const [session] = await db
    .select()
    .from(smokeSessions)
    .where(and(eq(smokeSessions.id, id), eq(smokeSessions.userId, userId)));

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [checkins, notes] = await Promise.all([
    db.select().from(smokeCheckins).where(eq(smokeCheckins.sessionId, id)).orderBy(asc(smokeCheckins.minutesMark)),
    db.select().from(smokeNotes).where(eq(smokeNotes.sessionId, id)).orderBy(asc(smokeNotes.createdAt)),
  ]);

  return NextResponse.json({ session, checkins, notes });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await require420Access();
  if (is420Forbidden(guard)) return guard;
  const { userId } = guard;
  const { id } = await params;

  const [session] = await db
    .select()
    .from(smokeSessions)
    .where(and(eq(smokeSessions.id, id), eq(smokeSessions.userId, userId)));

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { generateAI, ...rest } = parsed.data;

  const updates: Partial<typeof session> = { ...rest };

  if (rest.status === "closed" && !session.endedAt) {
    const now = new Date();
    updates.endedAt = now;
    const elapsed = Math.floor((now.getTime() - new Date(session.startedAt).getTime()) / 1000);
    updates.elapsedSeconds = elapsed;
  }

  // AI summary generation
  let aiSummary: string | null = null;
  if (generateAI) {
    const notes = await db.select().from(smokeNotes).where(eq(smokeNotes.sessionId, id));
    const checkins = await db.select().from(smokeCheckins).where(eq(smokeCheckins.sessionId, id));

    const notesText = notes.map((n) => `- [${n.type}] ${n.content}`).join("\n");
    const checkinsText = checkins.map((c) => `- Min ${c.minutesMark}: intensidad ${c.intensity}/10 — tags: ${(c.tags ?? []).join(", ")}`).join("\n");

    const prompt = `Sesión de tipo ${session.type} con método ${session.method}.
Duración: ${Math.round((updates.elapsedSeconds ?? session.elapsedSeconds ?? 0) / 60)} minutos.
Ratings: creatividad=${rest.creativityRating ?? "?"}, relax=${rest.relaxRating ?? "?"}, foco=${rest.focusRating ?? "?"}, euforia=${rest.euphoriaRating ?? "?"}, profundidad=${rest.depthRating ?? "?"}.

Check-ins de intensidad:
${checkinsText || "(ninguno)"}

Notas y pensamientos:
${notesText || "(ninguno)"}

Reflexión del usuario: ${rest.summary || "(ninguna)"}`;

    aiSummary = await callAI({
      model: "gpt-4o-mini",
      systemPrompt: "Eres un asistente de reflexión personal. Analiza esta sesión y entrega exactamente 3 insights concisos en español, en formato bullet list (•). Sé específico, observador y sin juzgar. Máximo 150 palabras total.",
      userMessage: prompt,
      maxTokens: 200,
      temperature: 0.7,
    });
  }

  const [updated] = await db
    .update(smokeSessions)
    .set({ ...updates, ...(aiSummary ? { aiSummary } : {}) })
    .where(eq(smokeSessions.id, id))
    .returning();

  return NextResponse.json(updated);
}
