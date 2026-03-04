/**
 * Uxuri Planning Agent MCP Server
 *
 * Agente de planificación con acceso completo a la DB del usuario.
 * Usa OpenAI para analizar tareas/proyectos/objetivos y trazar planes accionables.
 *
 * Conexión a Claude Code:
 *   /mcp add uxuri-planning -- npx tsx /home/dev/Projects/uxuri/planning-agent-mcp.ts
 *
 * Requiere en .env.local:
 *   DATABASE_URL, OPENAI_API_KEY, PUSHER_APP_ID, NEXT_PUBLIC_PUSHER_KEY,
 *   PUSHER_SECRET, NEXT_PUBLIC_PUSHER_CLUSTER
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// ── Load .env.local ────────────────────────────────────────────────────────────

function loadEnvFile(filename: string) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

// ── DB + Pusher + OpenAI ───────────────────────────────────────────────────────

import { neon } from "@neondatabase/serverless";
import Pusher from "pusher";
import OpenAI from "openai";

const sql = neon(process.env.DATABASE_URL!);

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// ── MCP Server ────────────────────────────────────────────────────────────────

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "uxuri-planning", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ── Tool definitions ──────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_user_context",
      description:
        "Obtiene el contexto completo del usuario: todas sus tareas, proyectos y objetivos con su estado actual. Úsalo antes de analizar para tener el panorama completo.",
      inputSchema: {
        type: "object" as const,
        properties: {
          userId: {
            type: "string",
            description: "ID de usuario de Clerk (ej: user_xxxxx)",
          },
        },
        required: ["userId"],
      },
    },
    {
      name: "get_planning_session",
      description:
        "Obtiene los detalles de una sesión de planificación específica: título, contexto vinculado, historial de mensajes.",
      inputSchema: {
        type: "object" as const,
        properties: {
          sessionId: {
            type: "string",
            description: "UUID de la sesión de planificación",
          },
        },
        required: ["sessionId"],
      },
    },
    {
      name: "analyze_and_plan",
      description: `Análisis estratégico completo: lee todos los datos del usuario, analiza brechas entre el estado actual y el objetivo, y genera un plan con opciones rankeadas por probabilidad de éxito.
Usar cuando el usuario diga cosas como: 'analiza mis tareas', 'ayúdame a cumplir mi objetivo', 'qué me falta', 'traza un plan'.
El resultado se envía automáticamente al chat de la sesión de planificación en tiempo real.`,
      inputSchema: {
        type: "object" as const,
        properties: {
          userId: {
            type: "string",
            description: "ID de usuario de Clerk",
          },
          sessionId: {
            type: "string",
            description: "UUID de la sesión de planificación activa",
          },
          objectiveDescription: {
            type: "string",
            description:
              "Descripción del objetivo que se está planificando. Puede ser el título de la sesión, el objetivo vinculado, o lo que el usuario ha descrito en el chat.",
          },
          focus: {
            type: "string",
            description:
              "Foco específico del análisis (opcional). Ej: 'riescos', 'recursos', 'timeline', 'brechas', 'prioridades'",
          },
        },
        required: ["userId", "sessionId", "objectiveDescription"],
      },
    },
    {
      name: "send_to_planning_session",
      description:
        "Envía un mensaje al chat de la sesión de planificación. Aparece en tiempo real como respuesta de NEXUS. Útil para enviar resultados parciales, preguntas de seguimiento o confirmaciones.",
      inputSchema: {
        type: "object" as const,
        properties: {
          sessionId: {
            type: "string",
            description: "UUID de la sesión de planificación",
          },
          content: {
            type: "string",
            description: "Contenido del mensaje a enviar al chat",
          },
        },
        required: ["sessionId", "content"],
      },
    },
    {
      name: "create_plan_tasks",
      description:
        "Crea tareas concretas derivadas del análisis de planificación. Las tareas quedan vinculadas al usuario y opcionalmente a un proyecto.",
      inputSchema: {
        type: "object" as const,
        properties: {
          userId: {
            type: "string",
            description: "ID de usuario — createdBy de las tareas",
          },
          sessionId: {
            type: "string",
            description: "UUID de la sesión — para confirmar en el chat",
          },
          projectId: {
            type: "string",
            description: "UUID del proyecto al que asignar las tareas (opcional)",
          },
          tasks: {
            type: "array",
            description: "Lista de tareas a crear",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "Título de la tarea" },
                description: {
                  type: "string",
                  description: "Descripción y contexto",
                },
                priority: {
                  type: "string",
                  enum: ["low", "medium", "high", "urgent"],
                },
              },
              required: ["title"],
            },
          },
        },
        required: ["userId", "sessionId", "tasks"],
      },
    },
    {
      name: "create_plan_objective",
      description:
        "Crea un nuevo objetivo derivado del análisis de planificación cuando el usuario no tiene uno existente o necesita uno más específico.",
      inputSchema: {
        type: "object" as const,
        properties: {
          userId: {
            type: "string",
            description: "ID de usuario",
          },
          sessionId: {
            type: "string",
            description: "UUID de la sesión — para confirmar en el chat",
          },
          title: { type: "string", description: "Título del objetivo" },
          description: {
            type: "string",
            description: "Descripción detallada",
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
            description: "Prioridad del objetivo",
          },
        },
        required: ["userId", "sessionId", "title"],
      },
    },
  ],
}));

// ── Tool handlers ─────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ── get_user_context ──────────────────────────────────────────────────
      case "get_user_context": {
        const { userId } = args as { userId: string };

        const [tasks, projects, objectives] = await Promise.all([
          sql`
            SELECT
              t.id, t.title, t.description, t.status, t.priority,
              t.due_date, t.created_at, t.assigned_to,
              p.name AS project_name,
              c.name AS client_name
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN clients c ON t.client_id = c.id
            WHERE t.created_by = ${userId} OR t.assigned_to = ${userId}
            ORDER BY t.status, t.priority DESC, t.created_at DESC
          `,
          sql`
            SELECT id, name, description, status, priority, start_date, end_date, created_at
            FROM projects
            WHERE created_by = ${userId}
            ORDER BY status, created_at DESC
          `,
          sql`
            SELECT
              o.id, o.title, o.description, o.status, o.priority, o.target_date,
              COUNT(DISTINCT om.id) AS milestone_count,
              COUNT(DISTINCT om.id) FILTER (WHERE om.done = true) AS milestones_done,
              COUNT(DISTINCT ot.id) AS linked_tasks
            FROM objectives o
            LEFT JOIN objective_milestones om ON om.objective_id = o.id
            LEFT JOIN objective_tasks ot ON ot.objective_id = o.id
            WHERE o.created_by = ${userId}
            GROUP BY o.id
            ORDER BY o.status, o.created_at DESC
          `,
        ]);

        const summary = {
          tasks: {
            total: tasks.length,
            byStatus: {
              todo: tasks.filter((t) => t.status === "todo").length,
              in_progress: tasks.filter((t) => t.status === "in_progress").length,
              review: tasks.filter((t) => t.status === "review").length,
              done: tasks.filter((t) => t.status === "done").length,
            },
            byPriority: {
              urgent: tasks.filter((t) => t.priority === "urgent").length,
              high: tasks.filter((t) => t.priority === "high").length,
              medium: tasks.filter((t) => t.priority === "medium").length,
              low: tasks.filter((t) => t.priority === "low").length,
            },
            list: tasks,
          },
          projects: {
            total: projects.length,
            active: projects.filter((p) => p.status === "active").length,
            list: projects,
          },
          objectives: {
            total: objectives.length,
            active: objectives.filter((o) => o.status === "active").length,
            list: objectives,
          },
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      }

      // ── get_planning_session ───────────────────────────────────────────────
      case "get_planning_session": {
        const { sessionId } = args as { sessionId: string };

        const [sessions, messages] = await Promise.all([
          sql`
            SELECT id, title, context_type, context_id, context_snapshot, status, created_at, updated_at
            FROM planning_sessions
            WHERE id = ${sessionId}
          `,
          sql`
            SELECT id, role, content, created_at
            FROM planning_messages
            WHERE session_id = ${sessionId}
            ORDER BY created_at ASC
          `,
        ]);

        if (sessions.length === 0) {
          return {
            content: [{ type: "text" as const, text: `Sesión ${sessionId} no encontrada.` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ ...sessions[0], messages }, null, 2),
            },
          ],
        };
      }

      // ── analyze_and_plan ───────────────────────────────────────────────────
      case "analyze_and_plan": {
        const { userId, sessionId, objectiveDescription, focus } = args as {
          userId: string;
          sessionId: string;
          objectiveDescription: string;
          focus?: string;
        };

        // 1. Pull all user data
        const [tasks, projects, objectives, sessionRows, messages] = await Promise.all([
          sql`
            SELECT
              t.id, t.title, t.description, t.status, t.priority, t.due_date,
              p.name AS project_name
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            WHERE t.created_by = ${userId} OR t.assigned_to = ${userId}
            ORDER BY t.status, t.priority DESC
          `,
          sql`
            SELECT id, name, description, status, priority, start_date, end_date
            FROM projects
            WHERE created_by = ${userId}
            ORDER BY status, created_at DESC
          `,
          sql`
            SELECT
              o.id, o.title, o.description, o.status, o.priority, o.target_date,
              COUNT(DISTINCT om.id) AS milestone_count,
              COUNT(DISTINCT om.id) FILTER (WHERE om.done = true) AS milestones_done
            FROM objectives o
            LEFT JOIN objective_milestones om ON om.objective_id = o.id
            WHERE o.created_by = ${userId}
            GROUP BY o.id
          `,
          sql`SELECT title, context_type, context_snapshot FROM planning_sessions WHERE id = ${sessionId}`,
          sql`SELECT role, content FROM planning_messages WHERE session_id = ${sessionId} ORDER BY created_at ASC`,
        ]);

        const sessionCtx = sessionRows[0];
        const chatHistory = messages
          .slice(-10) // last 10 messages for context
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((m: any) => `${m.role === "user" ? "Usuario" : "NEXUS"}: ${m.content}`)
          .join("\n\n");

        // 2. Build prompt
        const systemPrompt = `Eres NEXUS — un sistema de análisis estratégico no-lineal con acceso completo a los datos del usuario.

Tu tarea: analizar el estado actual del usuario y trazar el camino más probable hacia su objetivo.

PRINCIPIOS:
- Piensa en probabilidades reales, no en optimismo vacío
- Identifica cuellos de botella y dependencias ocultas
- Las recomendaciones deben ser accionables HOY, no en algún futuro hipotético
- Sé directo. Sin relleno.
- Responde en español

FORMATO DE SALIDA (usa este formato exacto):

## Diagnóstico rápido
[2-3 oraciones sobre el estado actual vs el objetivo]

## Brechas identificadas
[Lista de lo que falta o bloquea]

## Opciones estratégicas

### Opción A — [Nombre] | Probabilidad de éxito: XX%
[Descripción concisa]
- **Requiere:** [recursos/tiempo/condiciones]
- **Riesgo principal:** [el mayor peligro]
- **Primer paso concreto:** [acción específica de hoy]

### Opción B — [Nombre] | Probabilidad de éxito: XX%
[...]

### Opción C — [Nombre] | Probabilidad de éxito: XX%
[...]

## Mi recomendación
[Cuál opción y por qué. Directo.]

## Acciones inmediatas (esta semana)
1. [Acción específica]
2. [Acción específica]
3. [Acción específica]`;

        const focusNote = focus ? `\nFOCO ESPECÍFICO SOLICITADO: ${focus}` : "";

        const userMessage = `OBJETIVO QUE SE PLANIFICA:
"${objectiveDescription}"
${sessionCtx?.context_snapshot ? `\nCONTEXTO ADICIONAL:\n${JSON.stringify(sessionCtx.context_snapshot, null, 2)}` : ""}
${focusNote}

HISTORIAL DE LA SESIÓN (últimos mensajes):
${chatHistory || "(sin mensajes previos)"}

ESTADO ACTUAL DEL USUARIO:

TAREAS (${tasks.length} total):
${JSON.stringify(
  tasks.map((t) => ({
    título: t.title,
    estado: t.status,
    prioridad: t.priority,
    proyecto: t.project_name,
    vencimiento: t.due_date,
  })),
  null,
  2
)}

PROYECTOS (${projects.length} total):
${JSON.stringify(
  projects.map((p) => ({
    nombre: p.name,
    estado: p.status,
    prioridad: p.priority,
  })),
  null,
  2
)}

OBJETIVOS (${objectives.length} total):
${JSON.stringify(
  objectives.map((o) => ({
    título: o.title,
    estado: o.status,
    prioridad: o.priority,
    hitos: `${o.milestones_done}/${o.milestone_count}`,
  })),
  null,
  2
)}

Analiza todo esto y genera el plan estratégico siguiendo el formato indicado.`;

        // 3. Call OpenAI
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          max_tokens: 1500,
          temperature: 0.6,
        });

        const analysis = completion.choices[0].message.content ?? "No se pudo generar el análisis.";

        // 4. Save and broadcast to planning session
        const [savedMsg] = await sql`
          INSERT INTO planning_messages (session_id, role, content)
          VALUES (${sessionId}, 'assistant', ${analysis})
          RETURNING id, session_id, role, content, created_at
        `;

        await sql`
          UPDATE planning_sessions SET updated_at = NOW() WHERE id = ${sessionId}
        `;

        await pusher
          .trigger(`planning-${sessionId}`, "planning:message", savedMsg)
          .catch(() => {});

        return {
          content: [
            {
              type: "text" as const,
              text: `✅ Análisis enviado a la sesión de planificación.\n\n---\n\n${analysis}`,
            },
          ],
        };
      }

      // ── send_to_planning_session ───────────────────────────────────────────
      case "send_to_planning_session": {
        const { sessionId, content } = args as { sessionId: string; content: string };

        const [savedMsg] = await sql`
          INSERT INTO planning_messages (session_id, role, content)
          VALUES (${sessionId}, 'assistant', ${content})
          RETURNING id, session_id, role, content, created_at
        `;

        await sql`
          UPDATE planning_sessions SET updated_at = NOW() WHERE id = ${sessionId}
        `;

        await pusher
          .trigger(`planning-${sessionId}`, "planning:message", savedMsg)
          .catch(() => {});

        return {
          content: [
            {
              type: "text" as const,
              text: `Mensaje enviado a la sesión ${sessionId}.`,
            },
          ],
        };
      }

      // ── create_plan_tasks ──────────────────────────────────────────────────
      case "create_plan_tasks": {
        const { userId, sessionId, projectId, tasks: taskList } = args as {
          userId: string;
          sessionId: string;
          projectId?: string;
          tasks: { title: string; description?: string; priority?: string }[];
        };

        const created = [];
        for (const t of taskList) {
          const priority = t.priority ?? "medium";
          const [row] = await sql`
            INSERT INTO tasks (title, description, project_id, priority, status, created_by)
            VALUES (
              ${t.title},
              ${t.description ?? null},
              ${projectId ?? null},
              ${priority},
              'todo',
              ${userId}
            )
            RETURNING id, title, status, priority, project_id
          `;
          created.push(row);

          await pusher.trigger("tasks-global", "task:created", row).catch(() => {});
          if (row.project_id) {
            await pusher.trigger(`project-${row.project_id}`, "task:created", row).catch(() => {});
          }
        }

        // Confirm in planning session chat
        const confirmMsg = `✅ **${created.length} tarea(s) creadas:**\n${created.map((t) => `• ${t.title} (prioridad: ${t.priority})`).join("\n")}\n\nYa aparecen en tu lista de tareas en /tasks.`;

        const [savedMsg] = await sql`
          INSERT INTO planning_messages (session_id, role, content)
          VALUES (${sessionId}, 'assistant', ${confirmMsg})
          RETURNING id, session_id, role, content, created_at
        `;

        await sql`UPDATE planning_sessions SET updated_at = NOW() WHERE id = ${sessionId}`;
        await pusher.trigger(`planning-${sessionId}`, "planning:message", savedMsg).catch(() => {});

        return {
          content: [
            {
              type: "text" as const,
              text: `${created.length} tarea(s) creadas:\n${created.map((t) => `• ${t.title} (${t.id})`).join("\n")}`,
            },
          ],
        };
      }

      // ── create_plan_objective ──────────────────────────────────────────────
      case "create_plan_objective": {
        const { userId, sessionId, title, description, priority } = args as {
          userId: string;
          sessionId: string;
          title: string;
          description?: string;
          priority?: string;
        };

        const [objective] = await sql`
          INSERT INTO objectives (title, description, priority, status, created_by)
          VALUES (
            ${title},
            ${description ?? null},
            ${priority ?? "medium"},
            'active',
            ${userId}
          )
          RETURNING id, title, status, priority
        `;

        const confirmMsg = `🎯 **Nuevo objetivo creado:** "${objective.title}"\n\nPrioridad: ${objective.priority} · Estado: activo\nEncuéntralo en /objectives para añadir hitos y vincular tareas.`;

        const [savedMsg] = await sql`
          INSERT INTO planning_messages (session_id, role, content)
          VALUES (${sessionId}, 'assistant', ${confirmMsg})
          RETURNING id, session_id, role, content, created_at
        `;

        await sql`UPDATE planning_sessions SET updated_at = NOW() WHERE id = ${sessionId}`;
        await pusher.trigger(`planning-${sessionId}`, "planning:message", savedMsg).catch(() => {});

        return {
          content: [
            {
              type: "text" as const,
              text: `Objetivo creado: "${objective.title}" (${objective.id})`,
            },
          ],
        };
      }

      default:
        return {
          content: [{ type: "text" as const, text: `Herramienta desconocida: ${name}` }],
          isError: true,
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[planning-agent-mcp] Error en '${name}': ${message}\n`);
    return {
      content: [{ type: "text" as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("Uxuri Planning Agent MCP Server running\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
