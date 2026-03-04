import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { planningSessions, tasks, projects, objectives, clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<{ from?: string; id?: string }>;
};

export default async function NewPlanningPage({ searchParams }: PageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const sp = await searchParams;
  const from = sp.from as "task" | "project" | "objective" | "client" | undefined;
  const contextId = sp.id;

  let contextSnapshot: Record<string, unknown> | null = null;
  let title = "Nueva sesión";

  if (from && contextId) {
    if (from === "task") {
      const [t] = await db.select().from(tasks).where(eq(tasks.id, contextId));
      if (t) {
        contextSnapshot = { id: t.id, title: t.title, description: t.description, status: t.status, priority: t.priority };
        title = `Planificar: ${t.title}`;
      }
    } else if (from === "project") {
      const [p] = await db.select().from(projects).where(eq(projects.id, contextId));
      if (p) {
        contextSnapshot = { id: p.id, name: p.name, description: p.description, status: p.status };
        title = `Planificar: ${p.name}`;
      }
    } else if (from === "objective") {
      const [o] = await db.select().from(objectives).where(eq(objectives.id, contextId));
      if (o) {
        contextSnapshot = { id: o.id, title: o.title, description: o.description, status: o.status };
        title = `Planificar: ${o.title}`;
      }
    } else if (from === "client") {
      const [c] = await db.select().from(clients).where(eq(clients.id, contextId));
      if (c) {
        contextSnapshot = { id: c.id, name: c.name, company: c.company, status: c.status };
        title = `Planificar: ${c.name}`;
      }
    }
  }

  const [session] = await db.insert(planningSessions).values({
    title,
    contextType: (from ?? "blank") as "blank" | "task" | "project" | "objective" | "client",
    contextId: contextId ?? null,
    contextSnapshot,
    createdBy: userId,
  }).returning();

  redirect(`/planning/${session.id}`);
}
