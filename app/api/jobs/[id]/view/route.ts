import { db } from "@/db";
import { jobPostings } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;

  const isUuid = /^[0-9a-f-]{36}$/.test(id);

  await db
    .update(jobPostings)
    .set({ viewCount: sql`${jobPostings.viewCount} + 1` })
    .where(isUuid ? eq(jobPostings.id, id) : eq(jobPostings.slug, id));

  return NextResponse.json({ ok: true });
}
