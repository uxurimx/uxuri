import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { objectives, objectiveMilestones, objectiveProjects, objectiveTasks } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { ObjectivesList } from "@/components/objectives/objectives-list";

export default async function ObjectivesPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const rows = await db.select().from(objectives).orderBy(objectives.createdAt);

  const [milestoneCounts, projectCounts, taskCounts] = await Promise.all([
    db.select({ objectiveId: objectiveMilestones.objectiveId, total: count() })
      .from(objectiveMilestones)
      .groupBy(objectiveMilestones.objectiveId),
    db.select({ objectiveId: objectiveProjects.objectiveId, total: count() })
      .from(objectiveProjects)
      .groupBy(objectiveProjects.objectiveId),
    db.select({ objectiveId: objectiveTasks.objectiveId, total: count() })
      .from(objectiveTasks)
      .groupBy(objectiveTasks.objectiveId),
  ]);

  const enriched = rows.map((obj) => ({
    ...obj,
    milestoneCount: milestoneCounts.find((m) => m.objectiveId === obj.id)?.total ?? 0,
    projectCount: projectCounts.find((p) => p.objectiveId === obj.id)?.total ?? 0,
    taskCount: taskCounts.find((t) => t.objectiveId === obj.id)?.total ?? 0,
  }));

  return (
    <div>
      <ObjectivesList initialObjectives={enriched} />
    </div>
  );
}
