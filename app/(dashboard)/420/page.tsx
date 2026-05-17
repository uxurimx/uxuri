import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { smokeSessions, smokeCheckins, smokeNotes, users } from "@/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { Dashboard420 } from "@/components/420/dashboard-client";

const PRIVATE_EMAIL = "torresdevmx@gmail.com";

export const metadata = { title: "Flow — Uxuri" };

export default async function Page420() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.email !== PRIVATE_EMAIL) redirect("/dashboard");

  const sessionsRaw = await db
    .select()
    .from(smokeSessions)
    .where(eq(smokeSessions.userId, userId))
    .orderBy(desc(smokeSessions.startedAt))
    .limit(50);

  // Attach counts
  const sessions = await Promise.all(
    sessionsRaw.map(async (s) => {
      const [{ checkinCount }] = await db
        .select({ checkinCount: count() })
        .from(smokeCheckins)
        .where(eq(smokeCheckins.sessionId, s.id));
      const [{ noteCount }] = await db
        .select({ noteCount: count() })
        .from(smokeNotes)
        .where(eq(smokeNotes.sessionId, s.id));
      return { ...s, checkinCount: Number(checkinCount), noteCount: Number(noteCount) };
    })
  );

  const active = sessions.find((s) => s.status === "active") ?? null;
  const closed = sessions.filter((s) => s.status === "closed");

  // Compute stats server-side (avoid extra fetch complexity)
  const closedSessions = sessionsRaw.filter((s) => s.status === "closed");
  const totalSessions = closedSessions.length;
  const totalSeconds = closedSessions.reduce((sum, s) => sum + (s.elapsedSeconds ?? 0), 0);
  const withRating = closedSessions.filter((s) => s.overallRating);
  const avgRating = withRating.length
    ? Math.round((withRating.reduce((sum, s) => sum + (s.overallRating ?? 0), 0) / withRating.length) * 10) / 10
    : 0;
  const typeCounts: Record<string, number> = {};
  for (const s of closedSessions) typeCounts[s.type] = (typeCounts[s.type] ?? 0) + 1;
  const favoriteType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const stats = { totalSessions, totalSeconds, avgRating, favoriteType };

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 min-h-screen">
      <Dashboard420
        activeSession={active as any}
        sessions={closed as any}
        stats={stats}
      />
    </div>
  );
}
