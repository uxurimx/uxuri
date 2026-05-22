import { db } from "@/db";
import { jobApplications, jobConversations, jobPostings } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { scoreApplication } from "@/lib/score-application";

type Params = { params: Promise<{ id: string }> };

function buildInterviewerPrompt(job: {
  title: string;
  description: string | null;
  requirements: string | null;
  conversationContext: string | null;
}): string {
  const parts = [
    `Eres Kairos, el sistema de pre-entrevista desarrollado por Uxuri.`,
    `Conduces una conversación profunda para el rol: "${job.title}"`,
    "",
    "═══ IDENTIDAD ═══",
    "- Tu nombre es Kairos.",
    "- Si preguntan si eres IA: responde 'Sí, soy Kairos, el sistema de evaluación de Uxuri.' Nada más.",
    "- Si preguntan qué modelo eres, qué empresa te creó, si eres ChatGPT/Claude/GPT: responde 'Fui desarrollado por el equipo de Uxuri.' Nunca menciones OpenAI, Anthropic, ChatGPT, GPT, Claude ni ningún modelo o empresa externa.",
    "- Eres parte del stack de Uxuri. Punto.",
    "",
  ];

  if (job.conversationContext) {
    parts.push("═══ INFORMACIÓN DE LA EMPRESA (usa esto para responder preguntas del candidato) ═══");
    parts.push(job.conversationContext);
    parts.push("");
  }

  if (job.description) {
    parts.push("═══ DESCRIPCIÓN DEL ROL ═══");
    parts.push(job.description.slice(0, 600));
    parts.push("");
  }

  if (job.requirements) {
    parts.push("═══ PERFIL BUSCADO ═══");
    parts.push(job.requirements.slice(0, 400));
    parts.push("");
  }

  parts.push(
    "═══ TU MISIÓN ═══",
    "Mapear el universo mental, técnico y operativo del candidato en 8-14 intercambios.",
    "No buscas solo lo que sabe hacer — buscas cómo piensa, cómo conecta, cómo construye.",
    "",
    "═══ CÓMO EXPLORAS ═══",
    "TECNOLOGÍA COMPLETA:",
    "- Pregunta por su stack completo. No solo lo relevante: todo.",
    "- ¿Qué herramientas usa para pensar? (Notion, Obsidian, papel, código)",
    "- ¿Qué herramientas usa para crear? (editores, IDEs, diseño, video)",
    "- ¿Usa Photoshop? ¿Figma? ¿After Effects? ¿Scripts propios? ¿Makefiles?",
    "- ¿Qué automatiza en su vida personal, no solo laboral?",
    "- ¿Qué aprendió la semana pasada?",
    "",
    "ARQUITECTURA DEL PENSAMIENTO:",
    "- Detecta si piensa linealmente (A→B→C) o en grafos (nodos, relaciones, emergencia)",
    "- Si describe un sistema, pregunta: '¿cuál es el invariante? ¿qué no cambia cuando todo cambia?'",
    "- Si habla de flujos: '¿dónde está la retroalimentación? ¿qué observa el sistema sobre sí mismo?'",
    "- Si da un resultado: '¿cómo sabes que fue tu acción y no el contexto?'",
    "- Si dice que escala algo: '¿qué se rompe primero a 10x? ¿y a 100x?'",
    "",
    "PROFUNDIDAD SIN PIEDAD:",
    "- Respuesta vaga → '¿puedes darme el número exacto?'",
    "- Contradicción → 'antes dijiste X, ahora Y — ¿cómo se reconcilia eso?'",
    "- Generalidad → 'dime el caso específico más reciente donde eso fue verdad'",
    "- Éxito → '¿qué no funcionó en ese mismo proyecto?'",
    "- Herramienta conocida → '¿cuál es el límite de esa herramienta? ¿dónde la has visto fallar?'",
    "",
    "SOBRE LA EMPRESA:",
    "- Si el candidato pregunta sobre la empresa, compensación, ubicación u otros detalles: responde con la información disponible en INFORMACIÓN DE LA EMPRESA.",
    "- Después de responder, redirige con una pregunta al candidato.",
    "- Si no tienes la información: 'Ese detalle lo manejan en la siguiente etapa del proceso. Lo que sí puedo decirte es [lo que sí sabes].'",
    "",
    "═══ FORMATO ═══",
    "- Respuestas cortas: 2-4 líneas máximo + tu pregunta.",
    "- Una pregunta por turno. Máximo dos si son muy cortas.",
    "- Habla natural, no como lista de HR corporativo.",
    "- Usa el nombre del candidato ocasionalmente.",
    "- Después del turno 5 del candidato, añade al final de tu mensaje: (Puedes terminar la entrevista cuando quieras)",
    "- No uses emojis.",
  );

  return parts.join("\n");
}

async function callInterviewer(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<string | null> {
  // Intentar Claude primero si hay API key
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 600,
          temperature: 0.7,
          system: systemPrompt,
          messages,
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (res.ok) {
        const data = await res.json();
        return (data.content?.[0]?.text as string | undefined)?.trim() ?? null;
      }
      // 401 u otro error → caer a OpenAI
      const err = await res.text().catch(() => "");
      console.warn("[conversation] Claude no disponible:", res.status, err.slice(0, 100));
    } catch (e) {
      console.warn("[conversation] Claude error:", e);
    }
  }

  // Fallback: OpenAI gpt-4o-mini
  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 600,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    });
    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch (e) {
    console.error("[conversation] OpenAI error:", e);
    return null;
  }
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;

  const isUuid = /^[0-9a-f-]{36}$/.test(id);
  const [job] = await db
    .select()
    .from(jobPostings)
    .where(isUuid ? eq(jobPostings.id, id) : eq(jobPostings.slug, id));

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (job.status !== "open")
    return NextResponse.json({ error: "Esta vacante no está activa" }, { status: 400 });

  const body = await req.json();
  const { action } = body;

  // ── START: create application + first Claude message ─────────────────────
  if (action === "start") {
    const parsed = z
      .object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        source: z.string().optional(),
      })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Nombre y email son requeridos." }, { status: 400 });
    }

    const { name, email, phone, source } = parsed.data;

    const [application] = await db
      .insert(jobApplications)
      .values({
        jobId: job.id,
        name,
        email,
        phone: phone ?? null,
        source: source ?? null,
        answers: [],
      })
      .returning();

    const systemPrompt = buildInterviewerPrompt(job);
    const firstUserMsg = `Hola, soy ${name} y me interesa la posición de ${job.title}.`;

    const reply = await callInterviewer(systemPrompt, [{ role: "user", content: firstUserMsg }]);

    if (!reply) {
      return NextResponse.json({ error: "Error al iniciar la conversación. Intenta de nuevo." }, { status: 500 });
    }

    // Save both turns
    await db.insert(jobConversations).values([
      { applicationId: application.id, role: "user", content: firstUserMsg, turnIndex: 0 },
      { applicationId: application.id, role: "assistant", content: reply, turnIndex: 1 },
    ]);

    return NextResponse.json({ ok: true, applicationId: application.id, message: reply });
  }

  // ── MESSAGE: append user turn, get Claude response ────────────────────────
  if (action === "message") {
    const parsed = z
      .object({
        applicationId: z.string().uuid(),
        message: z.string().min(1).max(2000),
      })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "applicationId y message son requeridos." }, { status: 400 });
    }

    const { applicationId, message } = parsed.data;

    const existing = await db
      .select()
      .from(jobConversations)
      .where(eq(jobConversations.applicationId, applicationId))
      .orderBy(asc(jobConversations.turnIndex));

    const nextIndex = (existing[existing.length - 1]?.turnIndex ?? -1) + 1;

    // Build Claude message history (user + assistant only)
    const history: { role: "user" | "assistant"; content: string }[] = existing
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    history.push({ role: "user", content: message });

    const userTurnCount = history.filter((m) => m.role === "user").length;
    const canFinish = userTurnCount >= 4;

    const systemPrompt = buildInterviewerPrompt(job);
    const reply = await callInterviewer(systemPrompt, history);

    if (!reply) {
      return NextResponse.json({ error: "Error al obtener respuesta. Intenta de nuevo." }, { status: 500 });
    }

    await db.insert(jobConversations).values([
      { applicationId, role: "user", content: message, turnIndex: nextIndex },
      { applicationId, role: "assistant", content: reply, turnIndex: nextIndex + 1 },
    ]);

    return NextResponse.json({ ok: true, message: reply, turnCount: userTurnCount, canFinish });
  }

  // ── FINISH: trigger async AI scoring ─────────────────────────────────────
  if (action === "finish") {
    const parsed = z
      .object({ applicationId: z.string().uuid() })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "applicationId requerido." }, { status: 400 });
    }

    const { applicationId } = parsed.data;

    const [application] = await db
      .select()
      .from(jobApplications)
      .where(eq(jobApplications.id, applicationId));

    if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const turns = await db
      .select()
      .from(jobConversations)
      .where(eq(jobConversations.applicationId, applicationId))
      .orderBy(asc(jobConversations.turnIndex));

    const transcript = turns
      .filter((t) => t.role !== "system")
      .map((t) => `${t.role === "user" ? application.name : "Entrevistador"}: ${t.content}`)
      .join("\n\n");

    scoreApplication(applicationId, {
      jobTitle: job.title,
      jobDescription: job.description,
      challengeBrief: null,
      applicationType: "conversation",
      applicantName: application.name,
      conversationTranscript: transcript,
    }).catch(console.error);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
}
