import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ne } from "drizzle-orm";
import { NextResponse } from "next/server";

// Returns all users except the current user — for DM list
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await db
    .select({ id: users.id, name: users.name, imageUrl: users.imageUrl })
    .from(users)
    .where(ne(users.id, userId))
    .orderBy(users.name);

  return NextResponse.json(result);
}
