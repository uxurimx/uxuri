# CLAUDE.md — Uxuri

Sistema SaaS de administración personal y empresarial. Gestión de clientes, proyectos y tareas con autenticación, tiempo real y roles.

## Tech Stack

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router, Turbopack) |
| Auth | Clerk (webhook sync → DB) |
| DB | Neon (PostgreSQL serverless) + Drizzle ORM |
| Real-time | Pusher Channels |
| UI | Tailwind CSS v4 + Framer Motion |
| Formularios | React Hook Form + Zod |
| Deploy | Vercel |

## Estructura de rutas

```
/                        → Landing page (pública)
/sign-in, /sign-up       → Auth con Clerk
/dashboard               → Overview con KPIs
/clients                 → Lista de clientes
/clients/new             → Crear cliente
/clients/[id]            → Detalle + proyectos asociados
/projects                → Lista/tarjetas de proyectos
/projects/new            → Crear proyecto
/projects/[id]           → Detalle + tareas por columna
/tasks                   → Kanban board multi-proyecto
/users                   → Gestión de roles (solo admin)
```

## Sistema de roles

- **admin** → acceso total + panel `/users`
- **manager** → todo excepto panel de usuarios
- **client** → solo sus proyectos/tareas asignadas

Los roles se sincronizan entre la DB y Clerk `publicMetadata`. El middleware en `middleware.ts` protege rutas por rol.

## Comandos principales

```bash
npm run dev          # Dev server con Turbopack
npm run db:push      # Migrar schema a Neon (requiere DATABASE_URL)
npm run db:studio    # UI visual de la base de datos
npm run build        # Build de producción
```

## Variables de entorno requeridas

Ver `.env.example`. Necesitas configurar:
- Clerk: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
- Neon: `DATABASE_URL`
- Pusher: `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`, `PUSHER_APP_ID`, `PUSHER_SECRET`

## Archivos clave

- `db/schema/` — Tablas: users, clients, projects, tasks
- `lib/auth.ts` — Helpers: `getRole()`, `checkRole()`, `requireRole()`
- `lib/pusher.ts` — Instancias server + client de Pusher
- `hooks/use-pusher-channel.ts` — Hook para suscribirse a canales en tiempo real
- `middleware.ts` — Protección de rutas con Clerk
- `app/api/webhooks/clerk/` — Sync de usuarios Clerk → DB

## Identidad visual

- Primario: `#1e3a5f` (azul profundo)
- Fondo: blanco con acentos `slate-50`
- UI limpia y profesional, sin decoración excesiva

## Convenciones

- Server Components por defecto; `"use client"` solo donde se necesite interactividad
- Formularios con React Hook Form + Zod para validación
- Las páginas de detalle reciben datos como props desde la page (RSC fetch)
- Optimistic updates en KanbanBoard con revalidación vía `router.refresh()`
- Los API routes usan Zod para validar el body antes de escribir a DB
