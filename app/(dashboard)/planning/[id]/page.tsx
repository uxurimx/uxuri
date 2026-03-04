import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { planningSessions, planningMessages } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PlanningSession } from "@/components/planning/planning-session";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PlanningSessionPage({ params }: PageProps) {
  const { userId } = await auth();
  if (!userId) return null;

  const { id } = await params;

  const [session] = await db
    .select()
    .from(planningSessions)
    .where(and(eq(planningSessions.id, id), eq(planningSessions.createdBy, userId)));

  if (!session) notFound();

  const messages = await db
    .select()
    .from(planningMessages)
    .where(eq(planningMessages.sessionId, id))
    .orderBy(asc(planningMessages.createdAt));

  const data = JSON.parse(JSON.stringify({ ...session, messages }));

  return <PlanningSession session={data} />;
}
