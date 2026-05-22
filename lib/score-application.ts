import { db } from "@/db";
import { jobApplications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { callAI } from "@/lib/ai-call";
import type { JobAiFlag } from "@/db/schema";

interface ScoringContext {
  jobTitle: string;
  jobDescription: string | null;
  challengeBrief: string | null;
  applicationType: string;
  applicantName: string;
  submissionUrl?: string | null;
  submissionNotes?: string | null;
  answers?: { question: string; answer: string }[];
  videoTranscripts?: { question: string; transcript: string }[];
  conversationTranscript?: string | null;
}

interface AIScorecard {
  score: number;
  summary: string;
  flags: JobAiFlag[];
  recommendation: "shortlist" | "review" | "reject";
}

function buildSystemPrompt(): string {
  return `Eres un experto en reclutamiento para startups de tecnología. Evalúas candidatos con criterio de CEO: buscas ejecutores, no teóricos.

Tu tarea es analizar la aplicación y devolver un JSON con esta estructura exacta:
{
  "score": <número 1-10>,
  "summary": "<resumen de 3-4 líneas sobre el candidato, enfocado en evidencia real>",
  "flags": [
    {"type": "green_flag", "label": "<fortaleza>", "detail": "<por qué importa>"},
    {"type": "red_flag", "label": "<señal de alerta>", "detail": "<por qué es problema>"},
    {"type": "neutral", "label": "<observación>", "detail": "<contexto>"}
  ],
  "recommendation": "shortlist" | "review" | "reject"
}

Criterios de scoring:
- 9-10: Evidencia concreta de resultados, piensa en sistemas, actitud de socio
- 7-8: Buenos indicios, algo de evidencia, vale una conversación
- 5-6: Promesas sin evidencia, respuestas genéricas, posible potencial
- 3-4: Vago, copiado de templates, sin resultados reales
- 1-2: Spam, irrelevante, no entendió el reto

Sé directo y honesto. El CEO leerá esto para decidir en 30 segundos.
Responde SOLO con el JSON, sin texto adicional.`;
}

function buildUserMessage(ctx: ScoringContext): string {
  const lines: string[] = [
    `VACANTE: ${ctx.jobTitle}`,
    `TIPO: ${ctx.applicationType}`,
    `CANDIDATO: ${ctx.applicantName}`,
    "",
  ];

  if (ctx.jobDescription) {
    lines.push(`DESCRIPCIÓN DE LA VACANTE:\n${ctx.jobDescription.slice(0, 800)}`);
    lines.push("");
  }

  if (ctx.challengeBrief) {
    lines.push(`BRIEF DEL RETO:\n${ctx.challengeBrief}`);
    lines.push("");
  }

  if (ctx.submissionUrl) {
    lines.push(`EVIDENCIA ENVIADA (URL): ${ctx.submissionUrl}`);
  }

  if (ctx.submissionNotes) {
    lines.push(`DESCRIPCIÓN DE LA EVIDENCIA:\n${ctx.submissionNotes}`);
    lines.push("");
  }

  if (ctx.answers?.length) {
    lines.push("RESPUESTAS AL FORMULARIO:");
    ctx.answers.forEach(({ question, answer }) => {
      lines.push(`Q: ${question}`);
      lines.push(`R: ${answer}`);
      lines.push("");
    });
  }

  if (ctx.videoTranscripts?.length) {
    lines.push("TRANSCRIPCIONES DE VIDEO:");
    ctx.videoTranscripts.forEach(({ question, transcript }) => {
      lines.push(`Q: ${question}`);
      lines.push(`Transcript: ${transcript}`);
      lines.push("");
    });
  }

  if (ctx.conversationTranscript) {
    lines.push("TRANSCRIPCIÓN DE LA PRE-ENTREVISTA:");
    lines.push(ctx.conversationTranscript.slice(0, 3000));
    lines.push("");
  }

  return lines.join("\n");
}

export async function scoreApplication(
  applicationId: string,
  ctx: ScoringContext
): Promise<void> {
  try {
    const raw = await callAI({
      model: "claude-sonnet-4-6",
      systemPrompt: buildSystemPrompt(),
      userMessage: buildUserMessage(ctx),
      maxTokens: 800,
      temperature: 0.3,
    });

    if (!raw) return;

    // Extraer JSON — Claude a veces agrega markdown
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const scorecard: AIScorecard = JSON.parse(jsonMatch[0]);

    await db
      .update(jobApplications)
      .set({
        aiScore: Math.min(10, Math.max(1, scorecard.score)),
        aiSummary: scorecard.summary,
        aiFlags: scorecard.flags,
        aiRecommendation: scorecard.recommendation,
        aiScoredAt: new Date(),
      })
      .where(eq(jobApplications.id, applicationId));

  } catch (e) {
    console.error("[score-application] Error:", e);
  }
}
