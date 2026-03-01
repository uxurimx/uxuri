/**
 * Uxuri MCP Server — puente entre Claude Code y la web app
 *
 * Conexión:
 *   /mcp add uxuri -- npx tsx /home/dev/Projects/uxuri/mcp-server.ts
 *
 * Requiere: DATABASE_URL, PUSHER_APP_ID, NEXT_PUBLIC_PUSHER_KEY,
 *           PUSHER_SECRET, NEXT_PUBLIC_PUSHER_CLUSTER
 * Se cargan automáticamente desde .env.local
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

// ── DB + Pusher ────────────────────────────────────────────────────────────────

import { neon } from "@neondatabase/serverless";
import Pusher from "pusher";

const sql = neon(process.env.DATABASE_URL!);

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

// ── MCP Server ────────────────────────────────────────────────────────────────

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "uxuri", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ── Tool definitions ──────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_queued_tasks",
      description:
        "Obtiene todas las tareas con agentStatus='queued' pendientes de atención del agente IA. Incluye info del proyecto y agente asignado.",
      inputSchema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: "get_task_details",
      description: "Obtiene todos los detalles de una tarea específica por su ID.",
      inputSchema: {
        type: "object" as const,
        properties: {
          taskId: {
            type: "string",
            description: "UUID de la tarea",
          },
        },
        required: ["taskId"],
      },
    },
    {
      name: "get_conversation",
      description:
        "Obtiene el historial completo de mensajes del chat entre el agente y el usuario para una tarea.",
      inputSchema: {
        type: "object" as const,
        properties: {
          taskId: {
            type: "string",
            description: "UUID de la tarea",
          },
        },
        required: ["taskId"],
      },
    },
    {
      name: "send_message",
      description:
        "Envía un mensaje como agente al usuario en el chat de la tarea. El mensaje aparece en tiempo real en la web app.",
      inputSchema: {
        type: "object" as const,
        properties: {
          taskId: {
            type: "string",
            description: "UUID de la tarea",
          },
          content: {
            type: "string",
            description: "Contenido del mensaje a enviar al usuario",
          },
        },
        required: ["taskId", "content"],
      },
    },
    {
      name: "set_agent_status",
      description:
        "Actualiza el estado del agente en una tarea. Valores válidos: 'queued' | 'analyzing' | 'working' | 'done' | 'error'",
      inputSchema: {
        type: "object" as const,
        properties: {
          taskId: {
            type: "string",
            description: "UUID de la tarea",
          },
          status: {
            type: "string",
            enum: ["queued", "analyzing", "working", "done", "error"],
            description: "Nuevo estado del agente",
          },
        },
        required: ["taskId", "status"],
      },
    },
    {
      name: "mark_task_done",
      description:
        "Marca una tarea como completada: agentStatus='done' y status='done'. Envía notificación en tiempo real a la web app. Opcionalmente envía un mensaje resumen al usuario.",
      inputSchema: {
        type: "object" as const,
        properties: {
          taskId: {
            type: "string",
            description: "UUID de la tarea",
          },
          summary: {
            type: "string",
            description:
              "Mensaje opcional de resumen para enviar al usuario explicando qué se hizo",
          },
        },
        required: ["taskId"],
      },
    },
  ],
}));

// ── Tool handlers ─────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_queued_tasks": {
        const rows = await sql`
          SELECT
            t.id, t.title, t.description, t.status, t.priority,
            t.due_date, t.agent_status, t.project_id, t.agent_id,
            t.created_at, t.updated_at,
            p.name AS project_name,
            a.name AS agent_name,
            a.avatar AS agent_avatar,
            a.specialty AS agent_specialty
          FROM tasks t
          LEFT JOIN projects p ON t.project_id = p.id
          LEFT JOIN agents a ON t.agent_id = a.id
          WHERE t.agent_status = 'queued'
          ORDER BY t.created_at ASC
        `;
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(rows, null, 2),
            },
          ],
        };
      }

      case "get_task_details": {
        const taskId = (args as { taskId: string }).taskId;
        const rows = await sql`
          SELECT
            t.*,
            p.name AS project_name,
            c.name AS client_name,
            a.name AS agent_name,
            a.avatar AS agent_avatar,
            u.name AS assigned_user_name
          FROM tasks t
          LEFT JOIN projects p ON t.project_id = p.id
          LEFT JOIN clients c ON t.client_id = c.id
          LEFT JOIN agents a ON t.agent_id = a.id
          LEFT JOIN users u ON t.assigned_to = u.id
          WHERE t.id = ${taskId}
        `;
        if (rows.length === 0) {
          return {
            content: [{ type: "text" as const, text: `Tarea ${taskId} no encontrada.` }],
            isError: true,
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(rows[0], null, 2) }],
        };
      }

      case "get_conversation": {
        const taskId = (args as { taskId: string }).taskId;
        const rows = await sql`
          SELECT id, task_id, role, content, created_at
          FROM agent_messages
          WHERE task_id = ${taskId}
          ORDER BY created_at ASC
        `;
        return {
          content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }],
        };
      }

      case "send_message": {
        const { taskId, content } = args as { taskId: string; content: string };
        const [message] = await sql`
          INSERT INTO agent_messages (task_id, role, content)
          VALUES (${taskId}, 'agent', ${content})
          RETURNING id, task_id, role, content, created_at
        `;
        await pusher
          .trigger(`task-${taskId}`, "agent:message", message)
          .catch(() => {});
        return {
          content: [
            {
              type: "text" as const,
              text: `Mensaje enviado al usuario. ID: ${message.id}`,
            },
          ],
        };
      }

      case "set_agent_status": {
        const { taskId, status } = args as { taskId: string; status: string };
        await sql`
          UPDATE tasks
          SET agent_status = ${status}, updated_at = NOW()
          WHERE id = ${taskId}
        `;
        await pusher
          .trigger(`task-${taskId}`, "agent:status", { taskId, agentStatus: status })
          .catch(() => {});
        return {
          content: [
            {
              type: "text" as const,
              text: `agentStatus actualizado a '${status}' para tarea ${taskId}`,
            },
          ],
        };
      }

      case "mark_task_done": {
        const { taskId, summary } = args as { taskId: string; summary?: string };

        await sql`
          UPDATE tasks
          SET agent_status = 'done', status = 'done', updated_at = NOW()
          WHERE id = ${taskId}
        `;

        // Send summary message if provided
        if (summary) {
          const [message] = await sql`
            INSERT INTO agent_messages (task_id, role, content)
            VALUES (${taskId}, 'agent', ${summary})
            RETURNING id, task_id, role, content, created_at
          `;
          await pusher
            .trigger(`task-${taskId}`, "agent:message", message)
            .catch(() => {});
        }

        await pusher
          .trigger(`task-${taskId}`, "agent:done", { taskId, agentStatus: "done" })
          .catch(() => {});

        return {
          content: [
            {
              type: "text" as const,
              text: `Tarea ${taskId} marcada como completada.`,
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
  // Server is running — logs go to stderr to avoid polluting MCP stdio
  process.stderr.write("Uxuri MCP Server running\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
