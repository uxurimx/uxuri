import { NextResponse } from "next/server";
import { db } from "@/db";
import { smokeSessions, smokeCheckins, smokeNotes } from "@/db/schema";
import { eq, and, sql, desc, count, avg } from "drizzle-orm";
import { require420Access, is420Forbidden } from "@/lib/smoke-guard";

export async function GET() {
  const guard = await require420Access();
  if (is420Forbidden(guard)) return guard;
  const { userId } = guard;

  const sessions = await db
    .select()
    .from(smokeSessions)
    .where(and(eq(smokeSessions.userId, userId), eq(smokeSessions.status, "closed")))
    .orderBy(desc(smokeSessions.startedAt))
    .limit(200);

  const totalSessions = sessions.length;
  const totalSeconds = sessions.reduce((sum, s) => sum + (s.elapsedSeconds ?? 0), 0);
  const avgRating = sessions.length
    ? sessions.reduce((sum, s) => sum + (s.overallRating ?? 0), 0) / sessions.filter(s => s.overallRating).length
    : 0;

  // Favorite type
  const typeCounts: Record<string, number> = {};
  for (const s of sessions) typeCounts[s.type] = (typeCounts[s.type] ?? 0) + 1;
  const favoriteType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Favorite method
  const methodCounts: Record<string, number> = {};
  for (const s of sessions) methodCounts[s.method] = (methodCounts[s.method] ?? 0) + 1;
  const favoriteMethod = Object.entries(methodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Avg per dimension
  const withRatings = sessions.filter(s => s.creativityRating);
  const avgCreativity = withRatings.length ? withRatings.reduce((s, x) => s + (x.creativityRating ?? 0), 0) / withRatings.length : 0;
  const avgRelax = withRatings.length ? withRatings.reduce((s, x) => s + (x.relaxRating ?? 0), 0) / withRatings.length : 0;
  const avgFocus = withRatings.length ? withRatings.reduce((s, x) => s + (x.focusRating ?? 0), 0) / withRatings.length : 0;
  const avgEuphoria = withRatings.length ? withRatings.reduce((s, x) => s + (x.euphoriaRating ?? 0), 0) / withRatings.length : 0;
  const avgDepth = withRatings.length ? withRatings.reduce((s, x) => s + (x.depthRating ?? 0), 0) / withRatings.length : 0;

  // Heatmap — sessions per day (last 90 days)
  const heatmap: Record<string, number> = {};
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  for (const s of sessions) {
    if (new Date(s.startedAt) < cutoff) continue;
    const day = new Date(s.startedAt).toISOString().split("T")[0];
    heatmap[day] = (heatmap[day] ?? 0) + 1;
  }

  // Sessions by hour of day
  const byHour: number[] = Array(24).fill(0);
  for (const s of sessions) {
    const h = new Date(s.startedAt).getHours();
    byHour[h]++;
  }

  // Recent sessions for timeline (last 10)
  const recent = sessions.slice(0, 10);

  return NextResponse.json({
    totalSessions,
    totalSeconds,
    avgRating: Math.round(avgRating * 10) / 10,
    favoriteType,
    favoriteMethod,
    avgCreativity: Math.round(avgCreativity * 10) / 10,
    avgRelax: Math.round(avgRelax * 10) / 10,
    avgFocus: Math.round(avgFocus * 10) / 10,
    avgEuphoria: Math.round(avgEuphoria * 10) / 10,
    avgDepth: Math.round(avgDepth * 10) / 10,
    heatmap,
    byHour,
    recent,
  });
}
