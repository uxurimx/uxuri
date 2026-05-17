import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const PRIVATE_EMAIL = "torresdevmx@gmail.com";

export async function require420Access(): Promise<{ userId: string } | NextResponse> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.email !== PRIVATE_EMAIL) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return { userId };
}

export function is420Forbidden(result: { userId: string } | NextResponse): result is NextResponse {
  return result instanceof NextResponse;
}
