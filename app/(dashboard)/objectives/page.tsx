import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { objectives, objectiveMilestones, objectiveProjects, objectiveTasks, projects, tasks } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { ObjectivesList } from "@/components/objectives/objectives-list";

export default async function ObjectivesPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const rows = await db.select().from(objectives).orderBy(objectives.createdAt);

  const [milestoneCounts, projectCounts, taskCounts, allMilestones, linkedProjectsData, linkedTasksData] = await Promise.all([
    db.select({ objectiveId: objectiveMilestones.objectiveId, total: count() })
      .from(objectiveMilestones)
      .groupBy(objectiveMilestones.objectiveId),
    db.select({ objectiveId: objectiveProjects.objectiveId, total: count() })
      .from(objectiveProjects)
      .groupBy(objectiveProjects.objectiveId),
    db.select({ objectiveId: objectiveTasks.objectiveId, total: count() })
      .from(objectiveTasks)
      .groupBy(objectiveTasks.objectiveId),
    db.select().from(objectiveMilestones),
    db.select({ objectiveId: objectiveProjects.objectiveId, status: projects.status })
      .from(objectiveProjects)
      .leftJoin(projects, eq(objectiveProjects.projectId, projects.id)),
    db.select({ objectiveId: objectiveTasks.objectiveId, status: tasks.status })
      .from(objectiveTasks)
      .leftJoin(tasks, eq(objectiveTasks.taskId, tasks.id)),
  ]);

  const enriched = rows.map((obj) => {
    const mCount = milestoneCounts.find((m) => m.objectiveId === obj.id)?.total ?? 0;
    const mDone = allMilestones.filter((m) => m.objectiveId === obj.id && m.done).length;
    const mProgress = mCount > 0 ? Math.round((mDone / mCount) * 100) : null;

    const pCount = projectCounts.find((p) => p.objectiveId === obj.id)?.total ?? 0;
    const pCompleted = linkedProjectsData.filter(
      (p) => p.objectiveId === obj.id && p.status === "completed"
    ).length;
    const pProgress = pCount > 0 ? Math.round((pCompleted / pCount) * 100) : null;

    const tCount = taskCounts.find((t) => t.objectiveId === obj.id)?.total ?? 0;
    const tDone = linkedTasksData.filter(
      (t) => t.objectiveId === obj.id && t.status === "done"
    ).length;
    const tProgress = tCount > 0 ? Math.round((tDone / tCount) * 100) : null;

    const parts = [mProgress, pProgress, tProgress].filter((v): v is number => v !== null);
    const overallProgress = parts.length > 0 ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : 0;

    return {
      ...obj,
      milestoneCount: mCount,
      projectCount: pCount,
      taskCount: tCount,
      overallProgress,
    };
  });

  return (
    <div>
      <ObjectivesList initialObjectives={enriched} />
    </div>
  );
}
