import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { timeSessions } from "@/db/schema";
import { eq, and, gte, lte, ne } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();

  // Today range
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  // This week range (Mon-Sun)
  const day = now.getDay(); // 0=Sun
  const daysFromMon = day === 0 ? 6 : day - 1;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysFromMon);
  weekStart.setHours(0, 0, 0, 0);

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
