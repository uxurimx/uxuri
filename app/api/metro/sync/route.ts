import { db } from "@/db";
import { projects, tasks } from "@/db/schema";
import { eq, and, inArray, count } from "drizzle-orm";
import { NextResponse } from "next/server";

// MiniMetro game bridge — read-only, auth via X-Metro-Key header
// Never writes to uxuri DB. Returns projects + tasks optimized for the game.

const METRO_API_KEY = process.env.METRO_API_KEY;
const OWNER_USER_ID = process.env.OFFLINE_DEV_USER_ID ?? "";

export async function GET(req: Request) {
  // Auth: validate X-Metro-Key header
  const key = req.headers.get("x-metro-key");
  if (!METRO_API_KEY || key !== METRO_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch active + planning projects for the owner
  const userProjects = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.createdBy, OWNER_USER_ID),
        inArray(projects.status, ["active", "planning"])
      )
    )
    .orderBy(projects.momentum);

  if (userProjects.length === 0) {
    return NextResponse.json({ projects: [], tasks: [], syncedAt: new Date().toISOString() });
  }

  const projectIds = userProjects.map((p) => p.id);

  // Fetch all non-done tasks for those projects
  const userTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        inArray(tasks.projectId, projectIds),
        inArray(tasks.status, ["todo", "in_progress", "review"])
      )
    );

  // Build task counts per project
  const taskCountMap: Record<string, { total: number; urgent: number }> = {};
  for (const t of userTasks) {
    if (!t.projectId) continue;
    if (!taskCountMap[t.projectId]) taskCountMap[t.projectId] = { total: 0, urgent: 0 };
    taskCountMap[t.projectId].total++;
    if (t.priority === "urgent") taskCountMap[t.projectId].urgent++;
  }

  // Shape each project for the game
  const metroProjects = userProjects.map((p) => {
    const counts = taskCountMap[p.id] ?? { total: 0, urgent: 0 };

    // Days to deadline (null if no endDate)
    let deadlineDays: number | null = null;
    if (p.endDate) {
      const now = new Date();
      const end = new Date(p.endDate);
      deadlineDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      id: p.id,
      name: p.name,
      status: p.status,
      priority: p.priority,
      category: p.category ?? "",
      cycleMinutes: p.cycleMinutes ?? 60,
      momentum: p.momentum ?? 100,
      deadlineDays,          // null = no deadline, negative = overdue
      taskCount: counts.total,
      urgentCount: counts.urgent,
    };
  });

  // Shape tasks (minimal, only what the game needs)
  const metroTasks = userTasks.map((t) => ({
    id: t.id,
    projectId: t.projectId,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueDate: t.dueDate ?? null,
    energyLevel: t.energyLevel ?? null,
  }));

  return NextResponse.json({
    projects: metroProjects,
    tasks: metroTasks,
    syncedAt: new Date().toISOString(),
  });
}
