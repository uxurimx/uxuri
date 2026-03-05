import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  planningSessions, planningMessages,
  tasks, projects, objectives,
  taskComments, subtasks, objectiveMilestones,
} from "@/db/schema";
import { eq, and, asc, or, ne, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const messageSchema = z.object({ content: z.string().min(1) });

// ── Mood detection ────────────────────────────────────────────────────────────

type Mood =
  | "low_energy" | "high_energy" | "revenue"
  | "overwhelmed" | "time_constrained" | "lost" | "analysis"
  | null;

const MOOD_PATTERNS: { mood: Mood; keywords: string[] }[] = [
  { mood: "low_energy",       keywords: ["cansado","cansada","agotado","agotada","sin energía","sin energia","poca energía","poca energia","flojo","floja","somnolien","no tengo ganas"] },
  { mood: "high_energy",      keywords: ["lleno de energía","llena de energía","lleno de energia","llena de energia","motivado","motivada","con energía","con energia","activo","activa","productivo","productiva","con ganas","enfocado","enfocada"] },
  { mood: "revenue",          keywords: ["necesito dinero","necesito cash","necesito plata","quiero facturar","generar ingresos","cobrar","ventas","facturación","facturacion","ganar dinero","monetizar"] },
  { mood: "overwhelmed",      keywords: ["estresado","estresada","abrumado","abrumada","overwhelmed","no sé por dónde","no se por donde","demasiado","demasiadas tareas","saturado","saturada","mucho pendiente"] },
  { mood: "time_constrained", keywords: ["poco tiempo","solo tengo","minutos","media hora","una hora","15 min","30 min","45 min","rápido","rapido"] },
  { mood: "lost",             keywords: ["no sé qué hacer","no se que hacer","aburrido","aburrida","perdido","perdida","no sé por dónde empezar","no se por donde empezar","sin dirección","sin direccion"] },
  { mood: "analysis",         keywords: ["analiza","análisis","analiz","mis tareas","mis proyectos","mis objetivos","qué me falta","que me falta","cumplir","planif","prioridad","priorizar","cuello de botella","bloqueante","esta semana","ayúdame","ayudame","qué debería","que deberia","cómo avanzo","como avanzo","dónde estoy","donde estoy","recomiéndame","recomiendame"] },
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
  return match[2].toLowerCase().startsWith("h") ? n * 60 : n;
}

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

// ── Mood instructions ─────────────────────────────────────────────────────────

const MOOD_INSTRUCTIONS: Record<NonNullable<Mood>, string> = {
  low_energy:       `Usuario CANSADO. Solo recomienda tareas energía baja o <30min. Máx 3-4. Empieza con la más fácil. Tono comprensivo pero directo.`,
  high_energy:      `Usuario MOTIVADO. Prioriza tareas difíciles, estratégicas, creativas. Come the frog primero. Hasta 6 tareas en bloques. Tono energético.`,
  revenue:          `Usuario NECESITA INGRESOS. Primero tareas tipo revenue/clientes/facturación. Ordena por urgencia → impacto económico.`,
  overwhelmed:      `Usuario ABRUMADO. Máx 2-3 tareas. Solo urgentes. Dile explícitamente "ignora el resto por ahora." Tono calmado.`,
  time_constrained: `Usuario con POCO TIEMPO. Filtra por estMinutes <= tiempo disponible. Agrupa en un bloque: "En X minutos puedes hacer..." Tono eficiente.`,
  lost:             `Usuario PERDIDO. Dale UNA sola tarea (la más impactante). Explica en 1 oración por qué. Luego pregunta si la acepta.`,
  analysis:         `ANÁLISIS ESTRATÉGICO. Diagnostica estado actual vs objetivo de la sesión. Identifica brechas reales. Propón 2-3 opciones con % probabilidad de éxito. 3 acciones inmediatas esta semana.`,
};

// ── Formatters ────────────────────────────────────────────────────────────────

function formatTask(t: {
  id: string; title: string; description: string | null; status: string; priority: string;
  dueDate: string | null; energyLevel: string | null; estMinutes: number | null; taskType: string | null;
  projectName: string | null;
  comments: { userName: string | null; content: string; createdAt: Date }[];
  subtasks: { title: string; done: boolean }[];
}): string {
  const lines: string[] = [];
  lines.push(`  ┌ [${t.priority.toUpperCase()}] "${t.title}" (${t.status})`);

  const meta: string[] = [];
  if (t.projectName) meta.push(`proyecto: ${t.projectName}`);
  if (t.dueDate)     meta.push(`vence: ${t.dueDate}`);
  if (t.energyLevel) meta.push(`energía: ${t.energyLevel}`);
  if (t.estMinutes)  meta.push(`~${t.estMinutes}min`);
  if (t.taskType)    meta.push(`tipo: ${t.taskType}`);
  if (meta.length)   lines.push(`  │ ${meta.join(" · ")}`);

  if (t.description) {
    lines.push(`  │ Descripción: ${t.description.slice(0, 200)}${t.description.length > 200 ? "..." : ""}`);
  }

  if (t.subtasks.length > 0) {
    const done = t.subtasks.filter((s) => s.done).length;
    lines.push(`  │ Subtareas: ${done}/${t.subtasks.length} completadas`);
    t.subtasks.slice(0, 5).forEach((s) => lines.push(`  │   ${s.done ? "✓" : "○"} ${s.title}`));
  }

  if (t.comments.length > 0) {
    lines.push(`  │ Comentarios recientes (${t.comments.length}):`);
    t.comments.slice(-3).forEach((c) =>
      lines.push(`  │   [${c.userName ?? "?"}]: ${c.content.slice(0, 120)}${c.content.length > 120 ? "..." : ""}`)
    );
  }

  lines.push(`  └─`);
  return lines.join("\n");
}

function formatProject(p: {
  name: string; description: string | null; status: string; priority: string | null;
  startDate: string | null; endDate: string | null;
}): string {
  const meta: string[] = [`estado: ${p.status}`];
  if (p.priority)  meta.push(`prio: ${p.priority}`);
  if (p.startDate) meta.push(`inicio: ${p.startDate}`);
  if (p.endDate)   meta.push(`fin: ${p.endDate}`);
  const desc = p.description ? `\n     Desc: ${p.description.slice(0, 150)}${p.description.length > 150 ? "..." : ""}` : "";
  return `  • "${p.name}" — ${meta.join(", ")}${desc}`;
}

function formatObjective(o: {
  title: string; description: string | null; status: string; priority: string | null;
  targetDate: string | null;
  milestones: { title: string; done: boolean }[];
}): string {
  const meta: string[] = [`estado: ${o.status}`];
  if (o.priority)   meta.push(`prio: ${o.priority}`);
  if (o.targetDate) meta.push(`fecha objetivo: ${o.targetDate}`);
  const desc = o.description ? `\n     Desc: ${o.description.slice(0, 150)}${o.description.length > 150 ? "..." : ""}` : "";
  let milestoneStr = "";
  if (o.milestones.length > 0) {
    const done = o.milestones.filter((m) => m.done).length;
    milestoneStr = `\n     Hitos: ${done}/${o.milestones.length} — ` +
      o.milestones.slice(0, 4).map((m) => `${m.done ? "✓" : "○"} ${m.title}`).join(", ");
  }
  return `  • "${o.title}" — ${meta.join(", ")}${desc}${milestoneStr}`;
}

// ── System prompt builder ─────────────────────────────────────────────────────

function buildSystemPrompt(
  session: { contextType: string; contextSnapshot: unknown },
  dataContext: string,
  mood: Mood
): string {
  const moodBlock = mood
    ? `\n\n━━━ MODO: ${mood.toUpperCase()} ━━━\n${MOOD_INSTRUCTIONS[mood]}`
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

  return `Eres NEXUS — sistema de razonamiento estratégico con acceso completo a los datos del usuario.

PRINCIPIOS:
- Tienes acceso a TODO el contexto del usuario (tareas, descripciones, comentarios, subtareas, proyectos, objetivos). NUNCA pidas que te proporcionen datos.
- Lenguaje directo. Sin relleno. Responde en español.
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

  // ── Data injection ────────────────────────────────────────────────────────
  let dataContext = "";

  if (mood !== null) {
    // 1. Fetch active tasks with full fields
    const [rawTasks, userProjects, userObjectives] = await Promise.all([
      db
        .select({
          id: tasks.id,
          title: tasks.title,
          description: tasks.description,
          status: tasks.status,
          priority: tasks.priority,
          dueDate: tasks.dueDate,
          energyLevel: tasks.energyLevel,
          estMinutes: tasks.estMinutes,
          taskType: tasks.taskType,
          projectId: tasks.projectId,
        })
        .from(tasks)
        .where(
          and(
            or(eq(tasks.createdBy, userId), eq(tasks.assignedTo, userId)),
            ne(tasks.status, "done")
          )
        ),
      db
        .select({
          name: projects.name,
          description: projects.description,
          status: projects.status,
          priority: projects.priority,
          startDate: projects.startDate,
          endDate: projects.endDate,
        })
        .from(projects)
        .where(and(eq(projects.createdBy, userId), ne(projects.status, "completed"))),
      db
        .select({
          id: objectives.id,
          title: objectives.title,
          description: objectives.description,
          status: objectives.status,
          priority: objectives.priority,
          targetDate: objectives.targetDate,
        })
        .from(objectives)
        .where(
          and(
            eq(objectives.createdBy, userId),
            ne(objectives.status, "completed"),
            ne(objectives.status, "cancelled")
          )
        ),
    ]);

    // 2. Mood-aware task filtering (cap before fetching comments)
    let filteredTasks = [...rawTasks];

    if (mood === "low_energy") {
      const tagged = filteredTasks.filter((t) => t.energyLevel === "low");
      const short  = filteredTasks.filter((t) => !t.energyLevel && t.estMinutes != null && t.estMinutes <= 30);
      const rest   = filteredTasks.filter((t) => !t.energyLevel && (t.estMinutes == null || t.estMinutes > 30));
      filteredTasks = [...tagged, ...short, ...rest].slice(0, 20);
    } else if (mood === "high_energy") {
      const tagged    = filteredTasks.filter((t) => t.energyLevel === "high" || t.taskType === "strategic" || t.taskType === "creative");
      const highPrio  = filteredTasks.filter((t) => !tagged.includes(t) && (t.priority === "urgent" || t.priority === "high"));
      filteredTasks = [...tagged, ...highPrio].slice(0, 20);
    } else if (mood === "revenue") {
      const tagged = filteredTasks.filter((t) => t.taskType === "revenue");
      const rest   = filteredTasks.filter((t) => t.taskType !== "revenue");
      filteredTasks = [...tagged, ...rest].slice(0, 20);
    } else if (mood === "overwhelmed") {
      filteredTasks = filteredTasks
        .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3))
        .slice(0, 10);
    } else if (mood === "time_constrained" && availableMinutes) {
      const fits   = filteredTasks.filter((t) => t.estMinutes != null && t.estMinutes <= availableMinutes);
      const noMeta = filteredTasks.filter((t) => t.estMinutes == null);
      filteredTasks = [...fits, ...noMeta].slice(0, 15);
    } else if (mood === "lost") {
      filteredTasks = filteredTasks
        .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3))
        .slice(0, 5);
    } else {
      // analysis
      filteredTasks = filteredTasks
        .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3))
        .slice(0, 40);
    }

    // 3. Fetch comments + subtasks only for the filtered tasks (not all tasks)
    const taskIds = filteredTasks.map((t) => t.id);

    const [allComments, allSubtasks, allMilestones, projectMap] = await Promise.all([
      taskIds.length > 0
        ? db
            .select({ taskId: taskComments.taskId, userName: taskComments.userName, content: taskComments.content, createdAt: taskComments.createdAt })
            .from(taskComments)
            .where(inArray(taskComments.taskId, taskIds))
            .orderBy(asc(taskComments.createdAt))
        : Promise.resolve([]),
      taskIds.length > 0
        ? db
            .select({ taskId: subtasks.taskId, title: subtasks.title, done: subtasks.done })
            .from(subtasks)
            .where(inArray(subtasks.taskId, taskIds))
        : Promise.resolve([]),
      userObjectives.length > 0
        ? db
            .select({ objectiveId: objectiveMilestones.objectiveId, title: objectiveMilestones.title, done: objectiveMilestones.done })
            .from(objectiveMilestones)
            .where(inArray(objectiveMilestones.objectiveId, userObjectives.map((o) => o.id)))
        : Promise.resolve([]),
      // Build project name map from existing projects list
      Promise.resolve(
        Object.fromEntries(userProjects.map((p) => [p.name, p.name])) as Record<string, string>
      ),
    ]);

    // We need projectId → name map; fetch project names for task.projectId values
    const projectIds = [...new Set(filteredTasks.map((t) => t.projectId).filter(Boolean))] as string[];
    let projectIdNameMap: Record<string, string> = {};
    if (projectIds.length > 0) {
      const projRows = await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(inArray(projects.id, projectIds));
      projectIdNameMap = Object.fromEntries(projRows.map((p) => [p.id, p.name]));
    }

    // 4. Assemble enriched tasks
    const enrichedTasks = filteredTasks.map((t) => ({
      ...t,
      projectName: t.projectId ? (projectIdNameMap[t.projectId] ?? null) : null,
      comments: allComments.filter((c) => c.taskId === t.id),
      subtasks: allSubtasks.filter((s) => s.taskId === t.id),
    }));

    // 5. Assemble enriched objectives with milestones
    const enrichedObjectives = userObjectives.map((o) => ({
      ...o,
      milestones: allMilestones.filter((m) => m.objectiveId === o.id),
    }));

    const truncNote = rawTasks.length > filteredTasks.length
      ? ` (mostrando ${filteredTasks.length} de ${rawTasks.length} activas, filtradas por mood)`
      : "";

    dataContext = `

━━━ DATOS COMPLETOS DEL USUARIO${truncNote} ━━━

TAREAS ACTIVAS (${filteredTasks.length}):
${enrichedTasks.map(formatTask).join("\n") || "  • Sin tareas activas"}

PROYECTOS EN CURSO (${userProjects.length}):
${userProjects.map(formatProject).join("\n") || "  • Sin proyectos activos"}

OBJETIVOS ACTIVOS (${enrichedObjectives.length}):
${enrichedObjectives.map(formatObjective).join("\n") || "  • Sin objetivos activos"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
  } else {
    // Conversación libre: resumen ligero
    const counts = await db
      .select({ status: tasks.status })
      .from(tasks)
      .where(or(eq(tasks.createdBy, userId), eq(tasks.assignedTo, userId)));
    const pending = counts.filter((t) => t.status !== "done").length;
    dataContext = `\n\n[Resumen: ${pending} tareas pendientes. Dime cómo te sientes o pídeme un análisis para obtener recomendaciones completas con todo el contexto de tus tareas.]`;
  }

  // ── Call OpenAI with multi-turn conversation ──────────────────────────────
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
    max_tokens: 1000,
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
