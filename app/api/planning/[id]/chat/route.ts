import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { planningSessions, planningMessages } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { callAI } from "@/lib/ai-call";

const NEXUS_SYSTEM_PROMPT = `Eres NEXUS — un sistema de razonamiento estratégico no-lineal diseñado para colapsar la incertidumbre en claridad accionable.

Principios de operación:
- Pensamiento cuántico: explora múltiples posibilidades simultáneamente antes de colapsar en una dirección
- Lenguaje directo y poderoso. Sin relleno. Sin frases de cortesía vacías.
- Preguntas que desbloquean, no que confunden. Máximo 2 preguntas por respuesta.
- Convierte niebla en arquitectura ejecutable
- Cuando el usuario tenga claridad suficiente, propón concretamente: tareas, proyectos u objetivos
- Responde siempre en español

Formato de respuestas:
- Conciso pero profundo
- Usa bullets solo cuando clarifican estructura
- Cuando propongas crear algo concreto (tarea, proyecto u objetivo), termina con:
  **[ACCIÓN SUGERIDA]** — describe brevemente qué crear y por qué

No eres un asistente genérico. Eres un sistema de pensamiento estratégico. Actúa en consecuencia.`;

const messageSchema = z.object({
  content: z.string().min(1),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [session] = await db
    .select()
    .from(planningSessions)
    .where(and(eq(planningSessions.id, id), eq(planningSessions.createdBy, userId)));

  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Save user message
  await db.insert(planningMessages).values({
    sessionId: id,
    role: "user",
    content: parsed.data.content,
  });

  // Get conversation history
  const history = await db
    .select()
    .from(planningMessages)
    .where(eq(planningMessages.sessionId, id))
    .orderBy(asc(planningMessages.createdAt));

  // Build context block
  let contextBlock = "";
  if (session.contextType !== "blank" && session.contextSnapshot) {
    const snap = session.contextSnapshot as Record<string, unknown>;
    contextBlock = `\n\nCONTEXTO DE LA SESIÓN (${session.contextType}):\n${JSON.stringify(snap, null, 2)}`;
  }

  // Build conversation for OpenAI-style (callAI only supports single userMessage, so concat history)
  const historyText = history
    .map((m) => `${m.role === "user" ? "Usuario" : "NEXUS"}: ${m.content}`)
    .join("\n\n");

  const systemPrompt = NEXUS_SYSTEM_PROMPT + contextBlock;

  const aiResponse = await callAI({
    model: "gpt-4o-mini",
    systemPrompt,
    userMessage: historyText,
    maxTokens: 800,
    temperature: 0.7,
  });

  const responseContent = aiResponse ?? "No pude generar una respuesta. Intenta de nuevo.";

  // Save assistant message
  const [assistantMsg] = await db.insert(planningMessages).values({
    sessionId: id,
    role: "assistant",
    content: responseContent,
  }).returning();

  // Update session updatedAt
  await db
    .update(planningSessions)
    .set({ updatedAt: new Date() })
    .where(eq(planningSessions.id, id));

  return NextResponse.json({ message: assistantMsg });
}
