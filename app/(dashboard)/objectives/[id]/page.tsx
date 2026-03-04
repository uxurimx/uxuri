import Link from "next/link";
import { Zap } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  objectives,
  objectiveMilestones,
  objectiveProjects,
  objectiveTasks,
  objectiveAgents,
  objectiveAttachments,
  objectiveAreas,
  projects,
  tasks,
  agents,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ObjectiveDetail } from "@/components/objectives/objective-detail";

export default async function ObjectiveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;

  const { id } = await params;

  const [objective] = await db.select().from(objectives).where(eq(objectives.id, id));
  if (!objective) notFound();

  const [areas, milestones, linkedProjectRows, linkedTaskRows, linkedAgentRows, attachments] =
    await Promise.all([
      db
        .select()
        .from(objectiveAreas)
        .where(eq(objectiveAreas.objectiveId, id))
        .orderBy(objectiveAreas.sortOrder),
      db
        .select()
        .from(objectiveMilestones)
        .where(eq(objectiveMilestones.objectiveId, id))
        .orderBy(objectiveMilestones.sortOrder, objectiveMilestones.createdAt),
      db
        .select({ linkId: objectiveProjects.id, areaId: objectiveProjects.areaId, project: projects })
        .from(objectiveProjects)
        .leftJoin(projects, eq(objectiveProjects.projectId, projects.id))
        .where(eq(objectiveProjects.objectiveId, id)),
      db
        .select({ linkId: objectiveTasks.id, areaId: objectiveTasks.areaId, task: tasks })
        .from(objectiveTasks)
        .leftJoin(tasks, eq(objectiveTasks.taskId, tasks.id))
        .where(eq(objectiveTasks.objectiveId, id)),
      db
        .select({ linkId: objectiveAgents.id, agent: agents })
        .from(objectiveAgents)
        .leftJoin(agents, eq(objectiveAgents.agentId, agents.id))
        .where(eq(objectiveAgents.objectiveId, id)),
      db
        .select()
        .from(objectiveAttachments)
        .where(eq(objectiveAttachments.objectiveId, id))
        .orderBy(objectiveAttachments.createdAt),
    ]);

  // Progress calc
  const totalMilestones = milestones.length;
  const doneMilestones = milestones.filter((m) => m.done).length;
  const milestoneProgress = totalMilestones > 0
    ? Math.round((doneMilestones / totalMilestones) * 100)
    : null;

  const totalProjects = linkedProjectRows.filter((r) => r.project).length;
  const completedProjects = linkedProjectRows.filter((r) => r.project?.status === "completed").length;
  const projectProgress = totalProjects > 0
    ? Math.round((completedProjects / totalProjects) * 100)
    : null;

  const totalTasks = linkedTaskRows.filter((r) => r.task).length;
  const doneTasks = linkedTaskRows.filter((r) => r.task?.status === "done").length;
  const taskProgress = totalTasks > 0
    ? Math.round((doneTasks / totalTasks) * 100)
    : null;

  const parts = [taskProgress, projectProgress, milestoneProgress].filter(
    (v): v is number => v !== null
  );
  const overall =
    parts.length > 0
      ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length)
      : 0;

  const data = {
    ...objective,
    areas,
    milestones,
    linkedProjects: linkedProjectRows
      .filter((r) => r.project)
      .map((r) => ({ linkId: r.linkId, areaId: r.areaId, ...r.project! })),
    linkedTasks: linkedTaskRows
      .filter((r) => r.task)
      .map((r) => ({ linkId: r.linkId, areaId: r.areaId, ...r.task! })),
    linkedAgents: linkedAgentRows
      .filter((r) => r.agent)
      .map((r) => ({ linkId: r.linkId, ...r.agent! })),
    attachments,
    progress: { tasks: taskProgress, projects: projectProgress, milestones: milestoneProgress, overall },
  };

  // Serialize dates to strings for client component
  const serialized = JSON.parse(JSON.stringify(data));

  return (
    <div>
      <div className="flex justify-end mb-2">
        <Link
          href={`/planning/new?from=objective&id=${serialized.id}`}
          className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
        >
          <Zap className="w-3.5 h-3.5" />
          Planificar
        </Link>
      </div>
      <ObjectiveDetail objective={serialized} />
    </div>
  );
}
