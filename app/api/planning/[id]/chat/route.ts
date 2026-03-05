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

// ── Intent detection ──────────────────────────────────────────────────────────
// Separamos creación de mood para manejarlos independientemente

type CreateIntent = "task" | "project" | "objective" | null;

const CREATE_PATTERNS: { intent: CreateIntent; keywords: string[] }[] = [
  { intent: "task",      keywords: ["crea una tarea","crea tarea","crear tarea","añade una tarea","agrega una tarea","nueva tarea","quiero una tarea","crea el task","agregar tarea"] },
  { intent: "project",   keywords: ["crea un proyecto","crear proyecto","nuevo proyecto","crea proyecto","añade un proyecto"] },
  { intent: "objective", keywords: ["crea un objetivo","crear objetivo","nuevo objetivo","crea objetivo","añade un objetivo"] },
];

function detectCreateIntent(message: string): CreateIntent {
  const lower = message.toLowerCase();
  for (const { intent, keywords } of CREATE_PATTERNS) {
    if (keywords.some((kw) => lower.includes(kw))) return intent;
  }
  return null;
}

// Extrae el título del mensaje: lo que viene después de keywords de creación
function extractTitle(message: string, intent: CreateIntent): string {
  const lower = message.toLowerCase();
  const cleaners = [
    "crea una tarea llamada","crea una tarea con titulo","crea una tarea titulada","crea una tarea:",
    "crea una tarea","crea tarea","crear tarea","nueva tarea llamada","nueva tarea:",
    "nueva tarea","añade una tarea","agrega una tarea","quiero una tarea llamada","quiero una tarea:",
    "quiero una tarea",
    "crea un proyecto llamado","crea un proyecto titulado","crea un proyecto:","crea un proyecto","nuevo proyecto:",
    "nuevo proyecto","crear proyecto",
    "crea un objetivo llamado","crea un objetivo:","crea un objetivo","nuevo objetivo:","nuevo objetivo","crear objetivo",
  ];
  let result = message;
  for (const cleaner of cleaners) {
    if (lower.includes(cleaner)) {
      result = message.slice(lower.indexOf(cleaner) + cleaner.length).trim();
      break;
    }
  }
  // Remove quotes if present
  result = result.replace(/^["'«]|["'»]$/g, "").trim();
  return result || (intent === "task" ? "Nueva tarea" : intent === "project" ? "Nuevo proyecto" : "Nuevo objetivo");
}

// ── Mood detection ────────────────────────────────────────────────────────────

type Mood =
  | "low_energy" | "high_energy" | "revenue"
  | "overwhelmed" | "time_constrained" | "lost" | "analysis"
  | "general" // catch-all: any task/work related query
  | null;

const MOOD_PATTERNS: { mood: Mood; keywords: string[] }[] = [
  { mood: "low_energy",       keywords: ["cansado","cansada","agotado","agotada","sin energía","sin energia","poca energía","poca energia","flojo","floja","somnolien","no tengo ganas"] },
  { mood: "high_energy",      keywords: ["lleno de energía","llena de energía","lleno de energia","llena de energia","motivado","motivada","con energía","con energia","activo","activa","productivo","productiva","con ganas","enfocado","enfocada"] },
  { mood: "revenue",          keywords: ["necesito dinero","necesito cash","necesito plata","quiero facturar","generar ingresos","cobrar","ventas","facturación","facturacion","ganar dinero","monetizar"] },
  { mood: "overwhelmed",      keywords: ["estresado","estresada","abrumado","abrumada","no sé por dónde","no se por donde","demasiado","demasiadas tareas","saturado","saturada","mucho pendiente"] },
  { mood: "time_constrained", keywords: ["poco tiempo","solo tengo","minutos","media hora","una hora","15 min","30 min","45 min"] },
  { mood: "lost",             keywords: ["no sé qué hacer","no se que hacer","aburrido","aburrida","perdido","perdida","no sé por dónde empezar","no se por donde empezar","sin dirección","sin direccion"] },
  { mood: "analysis",         keywords: ["analiza","análisis","analiz","mis tareas","mis proyectos","mis objetivos","qué me falta","que me falta","cumplir","planif","prioridad","priorizar","cuello de botella","bloqueante","esta semana","ayúdame","ayudame","qué debería","que deberia","cómo avanzo","como avanzo","dónde estoy","donde estoy","recomiéndame","recomiendame"] },
  // General catch-all: any mention of work entities triggers full context
  { mood: "general",          keywords: ["tarea","proyecto","objetivo","cliente","pendiente","sprint","deadline","haz","hace","muéstrame","muestrame","dime","lista","listar","cuántas","cuantas","qué tengo","que tengo","qué hay","que hay","resumen","estado"] },
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
  low_energy:       `Usuario CANSADO. Solo recomienda tareas energía baja o <30min. Máx 3-4. Empieza con la más fácil.`,
  high_energy:      `Usuario MOTIVADO. Prioriza tareas difíciles, estratégicas, creativas. Eat the frog primero.`,
  revenue:          `Usuario NECESITA INGRESOS. Primero tareas tipo revenue/clientes/facturación.`,
  overwhelmed:      `Usuario ABRUMADO. Máx 2-3 tareas urgentes. "Ignora el resto por ahora."`,
  time_constrained: `Usuario con POCO TIEMPO. Filtra por estMinutes <= tiempo disponible.`,
  lost:             `Usuario PERDIDO. Dale UNA sola tarea. Explica por qué esa. Pregunta si la acepta.`,
  analysis:         `ANÁLISIS ESTRATÉGICO. Diagnostica brechas, propón 2-3 opciones con % probabilidad, 3 acciones inmediatas.`,
  general:          `Consulta general sobre tareas/proyectos. Responde usando los datos que tienes. Sé concreto y directo.`,
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
  if (t.description) lines.push(`  │ Desc: ${t.description.slice(0, 200)}${t.description.length > 200 ? "..." : ""}`);
  if (t.subtasks.length > 0) {
    const done = t.subtasks.filter((s) => s.done).length;
    lines.push(`  │ Subtareas ${done}/${t.subtasks.length}: ${t.subtasks.slice(0, 5).map((s) => `${s.done ? "✓" : "○"} ${s.title}`).join(" | ")}`);
  }
  if (t.comments.length > 0) {
    lines.push(`  │ Últimos comentarios:`);
    t.comments.slice(-3).forEach((c) =>
      lines.push(`  │   [${c.userName ?? "?"}]: ${c.content.slice(0, 120)}`)
    );
  }
  lines.push(`  └─`);
  return lines.join("\n");
}

function formatProject(p: {
  name: string; description: string | null; status: string; priority: string | null;
  startDate: string | null; endDate: string | null;
}): string {
  const meta = [`estado: ${p.status}`, p.priority && `prio: ${p.priority}`, p.endDate && `fin: ${p.endDate}`].filter(Boolean).join(", ");
  const desc = p.description ? `\n     Desc: ${p.description.slice(0, 150)}` : "";
  return `  • "${p.name}" — ${meta}${desc}`;
}

function formatObjective(o: {
  title: string; description: string | null; status: string; priority: string | null;
  targetDate: string | null; milestones: { title: string; done: boolean }[];
}): string {
  const meta = [`estado: ${o.status}`, o.priority && `prio: ${o.priority}`, o.targetDate && `objetivo: ${o.targetDate}`].filter(Boolean).join(", ");
  const desc = o.description ? `\n     Desc: ${o.description.slice(0, 150)}` : "";
  const ms = o.milestones.length > 0
    ? `\n     Hitos ${o.milestones.filter((m) => m.done).length}/${o.milestones.length}: ${o.milestones.slice(0, 4).map((m) => `${m.done ? "✓" : "○"} ${m.title}`).join(" | ")}`
    : "";
  return `  • "${o.title}" — ${meta}${desc}${ms}`;
}

// ── Full data fetcher ─────────────────────────────────────────────────────────

async function fetchUserData(userId: string, mood: NonNullable<Mood>, availableMinutes: number | null) {
  const [rawTasks, userProjects, userObjectives] = await Promise.all([
    db.select({
      id: tasks.id, title: tasks.title, description: tasks.description,
      status: tasks.status, priority: tasks.priority, dueDate: tasks.dueDate,
      energyLevel: tasks.energyLevel, estMinutes: tasks.estMinutes, taskType: tasks.taskType,
      projectId: tasks.projectId,
    }).from(tasks).where(and(or(eq(tasks.createdBy, userId), eq(tasks.assignedTo, userId)), ne(tasks.status, "done"))),
    db.select({ id: projects.id, name: projects.name, description: projects.description, status: projects.status, priority: projects.priority, startDate: projects.startDate, endDate: projects.endDate })
      .from(projects).where(and(eq(projects.createdBy, userId), ne(projects.status, "completed"))),
    db.select({ id: objectives.id, title: objectives.title, description: objectives.description, status: objectives.status, priority: objectives.priority, targetDate: objectives.targetDate })
      .from(objectives).where(and(eq(objectives.createdBy, userId), ne(objectives.status, "completed"), ne(objectives.status, "cancelled"))),
  ]);

  // Mood-aware task filtering
  let filtered = [...rawTasks];
  if (mood === "low_energy") {
    const a = filtered.filter((t) => t.energyLevel === "low");
    const b = filtered.filter((t) => !t.energyLevel && t.estMinutes != null && t.estMinutes <= 30);
    const c = filtered.filter((t) => !a.includes(t) && !b.includes(t));
    filtered = [...a, ...b, ...c].slice(0, 20);
  } else if (mood === "high_energy") {
    const a = filtered.filter((t) => t.energyLevel === "high" || t.taskType === "strategic" || t.taskType === "creative");
    const b = filtered.filter((t) => !a.includes(t) && (t.priority === "urgent" || t.priority === "high"));
    filtered = [...a, ...b].slice(0, 20);
  } else if (mood === "revenue") {
    const a = filtered.filter((t) => t.taskType === "revenue");
    filtered = [...a, ...filtered.filter((t) => t.taskType !== "revenue")].slice(0, 20);
  } else if (mood === "overwhelmed") {
    filtered = filtered.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)).slice(0, 10);
  } else if (mood === "time_constrained" && availableMinutes) {
    const a = filtered.filter((t) => t.estMinutes != null && t.estMinutes <= availableMinutes);
    filtered = [...a, ...filtered.filter((t) => t.estMinutes == null)].slice(0, 15);
  } else if (mood === "lost") {
    filtered = filtered.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)).slice(0, 5);
  } else {
    // analysis / general — sort by priority, cap at 40
    filtered = filtered.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)).slice(0, 40);
  }

  const taskIds = filtered.map((t) => t.id);
  const [allComments, allSubtasks, allMilestones] = await Promise.all([
    taskIds.length > 0
      ? db.select({ taskId: taskComments.taskId, userName: taskComments.userName, content: taskComments.content, createdAt: taskComments.createdAt })
          .from(taskComments).where(inArray(taskComments.taskId, taskIds)).orderBy(asc(taskComments.createdAt))
      : Promise.resolve([]),
    taskIds.length > 0
      ? db.select({ taskId: subtasks.taskId, title: subtasks.title, done: subtasks.done })
          .from(subtasks).where(inArray(subtasks.taskId, taskIds))
      : Promise.resolve([]),
    userObjectives.length > 0
      ? db.select({ objectiveId: objectiveMilestones.objectiveId, title: objectiveMilestones.title, done: objectiveMilestones.done })
          .from(objectiveMilestones).where(inArray(objectiveMilestones.objectiveId, userObjectives.map((o) => o.id)))
      : Promise.resolve([]),
  ]);

  // Project id → name map
  const projectIdNameMap: Record<string, string> = Object.fromEntries(userProjects.map((p) => [p.id, p.name]));

  const enrichedTasks = filtered.map((t) => ({
    ...t,
    projectName: t.projectId ? (projectIdNameMap[t.projectId] ?? null) : null,
    comments: allComments.filter((c) => c.taskId === t.id),
    subtasks: allSubtasks.filter((s) => s.taskId === t.id),
  }));

  const enrichedObjectives = userObjectives.map((o) => ({
    ...o,
    milestones: allMilestones.filter((m) => m.objectiveId === o.id),
  }));

  const truncNote = rawTasks.length > filtered.length
    ? ` (mostrando ${filtered.length} de ${rawTasks.length} activas)` : "";

  return `
━━━ DATOS COMPLETOS DEL USUARIO${truncNote} ━━━

TAREAS ACTIVAS (${filtered.length}):
${enrichedTasks.map(formatTask).join("\n") || "  • Sin tareas activas"}

PROYECTOS EN CURSO (${userProjects.length}):
${userProjects.map(formatProject).join("\n") || "  • Sin proyectos activos"}

OBJETIVOS ACTIVOS (${enrichedObjectives.length}):
${enrichedObjectives.map(formatObjective).join("\n") || "  • Sin objetivos activos"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
}

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(
  session: { contextType: string; contextSnapshot: unknown },
  dataContext: string,
  mood: Mood
): string {
  const moodBlock = mood ? `\n\n━━━ MODO: ${mood.toUpperCase()} ━━━\n${MOOD_INSTRUCTIONS[mood]}` : "";
  let contextBlock = "";
  if (session.contextType !== "blank" && session.contextSnapshot) {
    const snap = session.contextSnapshot as Record<string, unknown>;
    const labels: Record<string, string> = { task: "TAREA EN FOCO", project: "PROYECTO EN FOCO", objective: "OBJETIVO EN FOCO", client: "CLIENTE EN FOCO" };
    contextBlock = `\n\n${labels[session.contextType] ?? "CONTEXTO"}: ${JSON.stringify(snap, null, 2)}`;
  }
  return `Eres NEXUS — sistema de razonamiento estratégico con acceso COMPLETO a la base de datos del usuario.

REGLAS ABSOLUTAS:
- TIENES acceso a todos los datos del usuario. Están en este prompt. NUNCA digas que no tienes acceso.
- NUNCA pidas que te proporcionen sus tareas, proyectos u objetivos. Ya los tienes.
- Puedes crear tareas/proyectos/objetivos directamente. Cuando el usuario pida crear algo, HAZLO (se procesa automáticamente).
- Lenguaje directo. Sin relleno. Responde en español.
- Cuando crees algo: confirma qué creaste y pregunta si necesita algo más.${moodBlock}${dataContext}${contextBlock}`;
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

  // ── Intent: creation ─────────────────────────────────────────────────────
  const createIntent = detectCreateIntent(userMessage);
  if (createIntent) {
    const title = extractTitle(userMessage, createIntent);

    // Save user message
    await db.insert(planningMessages).values({ sessionId: id, role: "user", content: userMessage });

    // Create the entity directly
    let confirmMsg = "";
    try {
      if (createIntent === "task") {
        const [task] = await db.insert(tasks).values({ title, status: "todo", priority: "medium", createdBy: userId }).returning();
        confirmMsg = `✅ Tarea creada: **"${task.title}"**\nEstado: Por hacer · Prioridad: Media\n\nPuedes verla en /tasks. ¿Le agrego descripción, fecha límite o la asigno a alguien?`;
      } else if (createIntent === "project") {
        const [project] = await db.insert(projects).values({ name: title, status: "planning", createdBy: userId }).returning();
        confirmMsg = `✅ Proyecto creado: **"${project.name}"**\nEstado: Planificación\n\nPuedes verlo en /projects. ¿Le agrego descripción o fecha de entrega?`;
      } else {
        const [objective] = await db.insert(objectives).values({ title, status: "active", createdBy: userId }).returning();
        confirmMsg = `✅ Objetivo creado: **"${objective.title}"**\nEstado: Activo\n\nPuedes verlo en /objectives. ¿Le agrego descripción, fecha objetivo o hitos?`;
      }
    } catch {
      confirmMsg = `❌ No pude crear el elemento. Intenta de nuevo.`;
    }

    const [assistantMsg] = await db
      .insert(planningMessages)
      .values({ sessionId: id, role: "assistant", content: confirmMsg })
      .returning();

    await db.update(planningSessions).set({ updatedAt: new Date() }).where(eq(planningSessions.id, id));
    return NextResponse.json({ message: assistantMsg });
  }

  // ── Normal chat with mood/context ─────────────────────────────────────────
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

  // Fetch data if mood detected, else lightweight summary
  let dataContext = "";
  if (mood !== null) {
    dataContext = await fetchUserData(userId, mood, availableMinutes);
  } else {
    const counts = await db.select({ status: tasks.status }).from(tasks)
      .where(or(eq(tasks.createdBy, userId), eq(tasks.assignedTo, userId)));
    const pending = counts.filter((t) => t.status !== "done").length;
    const done = counts.filter((t) => t.status === "done").length;
    dataContext = `\n\n[Usuario tiene ${pending} tareas pendientes y ${done} completadas. Dime cómo te sientes o pídeme algo concreto.]`;
  }

  const systemPrompt = buildSystemPrompt(
    { contextType: session.contextType, contextSnapshot: session.contextSnapshot },
    dataContext, mood
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

  const responseContent = response.choices[0]?.message?.content?.trim() ?? "No pude generar una respuesta.";

  const [assistantMsg] = await db
    .insert(planningMessages)
    .values({ sessionId: id, role: "assistant", content: responseContent })
    .returning();

  await db.update(planningSessions).set({ updatedAt: new Date() }).where(eq(planningSessions.id, id));
  return NextResponse.json({ message: assistantMsg });
}
