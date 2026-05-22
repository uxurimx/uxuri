import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { deepBreaths } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { require420Access, is420Forbidden } from "@/lib/smoke-guard";

const postSchema = z.object({
  sessionId: z.string().uuid().optional().nullable(),
  durationSeconds: z.number().int().min(1),
  breathType: z.enum(["inhale", "inhale_hold"]).optional().default("inhale"),
  minutesMark: z.number().int().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET() {
  const guard = await require420Access();
  if (is420Forbidden(guard)) return guard;
  const { userId } = guard;

  const todayStr = new Date().toISOString().slice(0, 10);

  const [rows, todayRows] = await Promise.all([
    db.select()
      .from(deepBreaths)
      .where(eq(deepBreaths.userId, userId))
      .orderBy(desc(deepBreaths.createdAt))
      .limit(200),
    db.select()
      .from(deepBreaths)
      .where(and(eq(deepBreaths.userId, userId), eq(deepBreaths.date, todayStr))),
  ]);

  // Daily bests per date
  const byDate: Record<string, { best: number; count: number }> = {};
  for (const r of rows) {
    const d = r.date;
    if (!byDate[d]) byDate[d] = { best: 0, count: 0 };
    if (r.durationSeconds > byDate[d].best) byDate[d].best = r.durationSeconds;
    byDate[d].count++;
  }

  // Streak: consecutive days with at least 1 breath
  const dates = Object.keys(byDate).sort().reverse();
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < dates.length; i++) {
    const d = new Date(dates[i] + "T12:00:00");
    const daysAgo = Math.round((today.getTime() - d.getTime()) / 86400000);
    if (daysAgo === i || (i === 0 && daysAgo <= 1)) streak++;
    else break;
  }

  const todayBest = todayRows.reduce((m, r) => Math.max(m, r.durationSeconds), 0);
  const todayCount = todayRows.length;

  // All-time record
  const allTimeBest = rows.reduce((m, r) => Math.max(m, r.durationSeconds), 0);

  return NextResponse.json({
    breaths: rows,
    byDate,
    todayBest,
    todayCount,
    allTimeBest,
    streak,
  });
}

export async function POST(req: Request) {
  const guard = await require420Access();
  if (is420Forbidden(guard)) return guard;
  const { userId } = guard;

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const date = parsed.data.date ?? new Date().toISOString().slice(0, 10);
  const [row] = await db
    .insert(deepBreaths)
    .values({ userId, ...parsed.data, date })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
