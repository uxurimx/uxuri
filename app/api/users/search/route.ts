import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  const results = await db
    .select({ id: users.id, name: users.name, email: users.email, imageUrl: users.imageUrl })
    .from(users)
    .where(
      or(
        ilike(users.name, `%${q}%`),
        ilike(users.email, `%${q}%`)
      )
    )
    .limit(10);

  // Exclude the current user from results
  return NextResponse.json(results.filter((u) => u.id !== userId));
}
