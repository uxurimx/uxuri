import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { timeSessions } from "@/db/schema";
import { eq, and, gte, lte, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { startOfLocalDay, startOfLocalWeek } from "@/lib/date";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const todayStart = startOfLocalDay();
  const todayEnd = new Date(todayStart.getTime() + 24 * 3600 * 1000 - 1);
  const weekStart = startOfLocalWeek();

  const [todaySessions, weekSessions] = await Promise.all([
    db.select({ elapsedSeconds: timeSessions.elapsedSeconds, status: timeSessions.status, startedAt: timeSessions.startedAt })
      .from(timeSessions)
      .where(and(
        eq(timeSessions.userId, userId),
        gte(timeSessions.startedAt, todayStart),
        lte(timeSessions.startedAt, todayEnd),
        ne(timeSessions.status, "running"),
      )),
    db.select({ elapsedSeconds: timeSessions.elapsedSeconds, status: timeSessions.status })
      .from(timeSessions)
      .where(and(
        eq(timeSessions.userId, userId),
        gte(timeSessions.startedAt, weekStart),
        ne(timeSessions.status, "running"),
      )),
  ]);

  const todaySeconds = todaySessions.reduce((sum, s) => sum + s.elapsedSeconds, 0);
  const weekSeconds = weekSessions.reduce((sum, s) => sum + s.elapsedSeconds, 0);

  return NextResponse.json({
    todaySeconds,
    weekSeconds,
    todaySessions: todaySessions.length,
    weekSessions: weekSessions.length,
  });
}
