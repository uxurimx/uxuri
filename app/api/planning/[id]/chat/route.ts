import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { planningSessions, planningMessages, tasks, projects, objectives } from "@/db/schema";
import { eq, and, asc, or, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const messageSchema = z.object({ content: z.string().min(1) });

// ── Mood detection ────────────────────────────────────────────────────────────

type Mood =
  | "low_energy"
  | "high_energy"
  | "revenue"
  | "overwhelmed"
  | "time_constrained"
  | "lost"
  | "analysis"
  | null;

const MOOD_PATTERNS: { mood: Mood; keywords: string[] }[] = [
  {
    mood: "low_energy",
    keywords: ["cansado", "cansada", "agotado", "agotada", "sin energía", "sin energia",
      "poca energía", "poca energia", "flojo", "floja", "somnolient", "no tengo ganas"],
  },
  {
    mood: "high_energy",
    keywords: ["lleno de energía", "llena de energía", "lleno de energia", "llena de energia",
      "motivado", "motivada", "con energía", "con energia", "activo", "activa",
      "productivo", "productiva", "con ganas", "enfocado", "enfocada"],
  },
  {
    mood: "revenue",
    keywords: ["necesito dinero", "necesito cash", "necesito plata", "quiero facturar",
      "generar ingresos", "cobrar", "ventas", "clientes", "facturación", "facturacion",
      "ganar dinero", "monetizar"],
  },
  {
    mood: "overwhelmed",
    keywords: ["estresado", "estresada", "abrumado", "abrumada", "overwhelmed",
      "no sé por dónde", "no se por donde", "demasiado", "demasiadas tareas",
      "saturado", "saturada", "mucho pendiente"],
  },
  {
    mood: "time_constrained",
    keywords: ["poco tiempo", "solo tengo", "en", "minutos", "media hora", "una hora",
      "15 min", "30 min", "45 min", "rápido", "rapido", "corto"],
  },
  {
    mood: "lost",
    keywords: ["no sé qué hacer", "no se que hacer", "aburrido", "aburrida",
      "perdido", "perdida", "no sé por dónde empezar", "no se por donde empezar",
      "sin dirección", "sin direccion"],
  },
  {
    mood: "analysis",
    keywords: ["analiza", "análisis", "analiz", "tareas", "proyectos", "objetivos",
      "qué me falta", "que me falta", "cumplir", "plan", "planif",
      "prioridad", "priorizar", "cuello de botella", "bloqueante",
      "esta semana", "hoy", "urgente", "ayúdame", "ayudame",
      "qué debería", "que deberia", "cómo avanzo", "como avanzo",
      "dónde estoy", "donde estoy", "recomiéndame", "recomiendame"],
  },
];

function detectMood(message: string): Mood {
  const lower = message.toLowerCase();
  for (const { mood, keywords } of MOOD_PATTERNS) {
    if (keywords.some((kw) => lower.includes(kw))) return mood;
  }
  return null;
}

function extractTimeMinutes(message: string): number | null {
  const match = message.match(/(\d+)\s*(min|minutos?|hora?s?|h\b)/i);
  if (!match) return null;
  const n = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  return unit.startsWith("h") ? n * 60 : n;
}

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

// ── Mood instructions for NEXUS ───────────────────────────────────────────────

const MOOD_INSTRUCTIONS: Record<NonNullable<Mood>, string> = {
  low_energy: `El usuario está CANSADO o con poca energía.
REGLAS:
- Recomienda SOLO tareas marcadas como energía baja (🔋) o con menos de 30 minutos estimados.
- Si no hay con esa metadata, infiere por título: tareas administrativas simples, revisiones, responder mensajes.
- Máximo 3-4 tareas. Empieza con la más fácil (victoria rápida).
- Menciona el tiempo estimado si lo tienes.
- Tono: comprensivo pero directo. No dramático.`,

  high_energy: `El usuario está MOTIVADO y con energía alta.
REGLAS:
- Prioriza tareas de alta energía (🔥), alta prioridad, o tipo estratégico/creativo.
- Sugiere atacar EL problema más difícil primero (eat the frog).
- Puedes recomendar hasta 5-6 tareas agrupadas en bloques.
- Tono: energético, momentum.`,

  revenue: `El usuario NECESITA GENERAR INGRESOS.
REGLAS:
- Prioriza tareas tipo 'revenue' (💰) primero.
- Si no hay etiquetadas, busca: tareas con clientes en el nombre, proyectos activos con clientes, "cotizar", "propuesta", "factura", "cobro".
- Ordena por urgencia → impacto económico estimado.
- Tono: enfocado en resultados económicos, sin rodeos.`,

  overwhelmed: `El usuario está ABRUMADO o estresado.
REGLAS:
- REDUCE el ruido. Muestra solo 2-3 tareas máximo.
- Criterio: urgentes primero, luego las que más alivio darían al completarlas.
- Dile claramente: "Ignora todo lo demás por ahora."
- Tono: calmado, estructurado, seguro.`,

  time_constrained: `El usuario tiene POCO TIEMPO disponible.
REGLAS:
- Usa el tiempo extraído del mensaje para filtrar tareas con estMinutes <= ese tiempo.
- Si no hay metadata de tiempo, infiere tareas cortas por título.
- Agrupa en un bloque de trabajo: "En X minutos puedes hacer..."
- Tono: eficiente, sin relleno.`,

  lost: `El usuario NO SABE POR DÓNDE EMPEZAR.
REGLAS:
- Dale UNA sola tarea. La más impactante o urgente.
- Explica en 1 oración por qué esa y no otra.
- Luego pregunta: ¿La hacemos o prefieres otra cosa?
- Tono: simple, claro, decisivo.`,

  analysis: `El usuario pide un ANÁLISIS ESTRATÉGICO.
REGLAS:
- Diagnostica el estado actual vs el objetivo de la sesión.
- Identifica brechas reales (tareas bloqueadas, sin prioridad clara, sin fecha).
- Propón 2-3 opciones con % de probabilidad de éxito.
- Lista 3 acciones inmediatas para esta semana.
- Tono: estratégico, datos primero.`,
};

// ── System prompt builder ─────────────────────────────────────────────────────

function buildSystemPrompt(
  session: { contextType: string; contextSnapshot: unknown },
  dataContext: string,
  mood: Mood
): string {
  const moodBlock = mood
    ? `\n\n━━━ MODO ACTIVO: ${mood.toUpperCase()} ━━━\n${MOOD_INSTRUCTIONS[mood]}`
    : "";

  let contextBlock = "";
  if (session.contextType !== "blank" && session.contextSnapshot) {
    const snap = session.contextSnapshot as Record<string, unknown>;
    const labels: Record<string, string> = {
      task: "TAREA EN FOCO", project: "PROYECTO EN FOCO",
      objective: "OBJETIVO EN FOCO", client: "CLIENTE EN FOCO",
    };
    contextBlock = `\n\n${labels[session.contextType] ?? "CONTEXTO"}: ${JSON.stringify(snap, null, 2)}`;
  }

  return `Eres NEXUS — sistema de razonamiento estratégico con acceso a los datos reales del usuario.

PRINCIPIOS BASE:
- Tienes acceso directo a las tareas del usuario. NUNCA pidas que te las proporcionen.
- Lenguaje directo. Sin relleno. Sin cortesías vacías.
- Responde siempre en español.
- Cuando propongas crear algo: **[ACCIÓN SUGERIDA]** — qué y por qué.${moodBlock}${dataContext}${contextBlock}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

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
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const userMessage = parsed.data.content;
  const mood = detectMood(userMessage);
  const availableMinutes = mood === "time_constrained" ? extractTimeMinutes(userMessage) : null;

  // Save user message
  await db.insert(planningMessages).values({ sessionId: id, role: "user", content: userMessage });

  // Get conversation history
  const history = await db
    .select()
    .from(planningMessages)
    .where(eq(planningMessages.sessionId, id))
    .orderBy(asc(planningMessages.createdAt));

  // ── Smart data injection ─────────────────────────────────────────────────────
  let dataContext = "";

  if (mood !== null) {
    // Fetch active tasks only — never completed
    const [activeTasks, userProjects, userObjectives] = await Promise.all([
      db
        .select({
          title: tasks.title,
          status: tasks.status,
          priority: tasks.priority,
          dueDate: tasks.dueDate,
          energyLevel: tasks.energyLevel,
          estMinutes: tasks.estMinutes,
          taskType: tasks.taskType,
        })
        .from(tasks)
        .where(
          and(
            or(eq(tasks.createdBy, userId), eq(tasks.assignedTo, userId)),
            ne(tasks.status, "done")
          )
        ),
      db
        .select({ name: projects.name, status: projects.status, priority: projects.priority })
        .from(projects)
        .where(and(eq(projects.createdBy, userId), ne(projects.status, "completed"))),
      db
        .select({ title: objectives.title, status: objectives.status, priority: objectives.priority })
        .from(objectives)
        .where(
          and(
            eq(objectives.createdBy, userId),
            ne(objectives.status, "completed"),
            ne(objectives.status, "cancelled")
          )
        ),
    ]);

    // ── Mood-aware filtering ─────────────────────────────────────────────────
    let filteredTasks = [...activeTasks];

    if (mood === "low_energy") {
      // Tagged low-energy first, then short tasks, then the rest
      const tagged = filteredTasks.filter((t) => t.energyLevel === "low");
      const short = filteredTasks.filter((t) => !t.energyLevel && t.estMinutes && t.estMinutes <= 30);
      const rest = filteredTasks.filter((t) => !t.energyLevel && (!t.estMinutes || t.estMinutes > 30));
      filteredTasks = [...tagged, ...short, ...rest].slice(0, 20);
    } else if (mood === "high_energy") {
      const tagged = filteredTasks.filter((t) => t.energyLevel === "high" || t.taskType === "strategic" || t.taskType === "creative");
      const highPrio = filteredTasks.filter((t) => !tagged.includes(t) && (t.priority === "urgent" || t.priority === "high"));
      filteredTasks = [...tagged, ...highPrio].slice(0, 20);
    } else if (mood === "revenue") {
      const tagged = filteredTasks.filter((t) => t.taskType === "revenue");
      const rest = filteredTasks.filter((t) => t.taskType !== "revenue");
      filteredTasks = [...tagged, ...rest].slice(0, 20);
    } else if (mood === "overwhelmed") {
      // Only urgent + high priority, max 10
      filteredTasks = filteredTasks
        .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3))
        .slice(0, 10);
    } else if (mood === "time_constrained" && availableMinutes) {
      const fits = filteredTasks.filter((t) => t.estMinutes && t.estMinutes <= availableMinutes);
      const noMeta = filteredTasks.filter((t) => !t.estMinutes);
      filteredTasks = [...fits, ...noMeta].slice(0, 15);
    } else if (mood === "lost") {
      filteredTasks = filteredTasks
        .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3))
        .slice(0, 5);
    } else {
      // analysis — sort by priority, cap at 50
      filteredTasks = filteredTasks
        .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3))
        .slice(0, 50);
    }

    const taskLines = filteredTasks.map((t) => {
      const energy = t.energyLevel ? ` [energía: ${t.energyLevel}]` : "";
      const time = t.estMinutes ? ` [~${t.estMinutes}min]` : "";
      const type = t.taskType ? ` [${t.taskType}]` : "";
      const due = t.dueDate ? ` vence: ${t.dueDate}` : "";
      return `  • [${t.priority.toUpperCase()}] "${t.title}" (${t.status})${energy}${time}${type}${due}`;
    });

    const truncNote =
      activeTasks.length > filteredTasks.length
        ? ` (mostrando ${filteredTasks.length} de ${activeTasks.length} activas`
        + (mood === "low_energy" ? ", priorizadas por energía baja)" : mood === "revenue" ? ", priorizadas por ingresos)" : ")")
        : "";

    dataContext = `

━━━ DATOS DEL USUARIO${truncNote} ━━━
TAREAS ACTIVAS (${filteredTasks.length}):
${taskLines.join("\n") || "  • Sin tareas activas"}

PROYECTOS EN CURSO (${userProjects.length}):
${userProjects.map((p) => `  • "${p.name}" — ${p.status}${p.priority ? `, prio: ${p.priority}` : ""}`).join("\n") || "  • Sin proyectos activos"}

OBJETIVOS ACTIVOS (${userObjectives.length}):
${userObjectives.map((o) => `  • "${o.title}" — ${o.status}${o.priority ? `, prio: ${o.priority}` : ""}`).join("\n") || "  • Sin objetivos activos"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  } else {
    // Conversación libre: solo un resumen ligero
    const counts = await db
      .select({ status: tasks.status })
      .from(tasks)
      .where(or(eq(tasks.createdBy, userId), eq(tasks.assignedTo, userId)));
    const pending = counts.filter((t) => t.status !== "done").length;
    dataContext = `\n\n[Resumen: ${pending} tareas pendientes. Pídeme análisis o dime cómo te sientes para recomendaciones personalizadas.]`;
  }

  // ── Call OpenAI with multi-turn conversation ────────────────────────────────
  const systemPrompt = buildSystemPrompt(
    { contextType: session.contextType, contextSnapshot: session.contextSnapshot },
    dataContext,
    mood
  );

  const openAIMessages: OpenAI.Chat.ChatCompletionMessageParam[] = history.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
  }));

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: systemPrompt }, ...openAIMessages],
    max_tokens: 900,
    temperature: 0.75,
  });

  const responseContent =
    response.choices[0]?.message?.content?.trim() ?? "No pude generar una respuesta. Intenta de nuevo.";

  const [assistantMsg] = await db
    .insert(planningMessages)
    .values({ sessionId: id, role: "assistant", content: responseContent })
    .returning();

  await db.update(planningSessions).set({ updatedAt: new Date() }).where(eq(planningSessions.id, id));

  return NextResponse.json({ message: assistantMsg });
}
