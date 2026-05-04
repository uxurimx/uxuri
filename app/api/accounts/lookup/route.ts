import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { accounts, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address")?.toLowerCase().trim();
  if (!address) return NextResponse.json({ error: "address requerida" }, { status: 400 });

  const [row] = await db
    .select({
      id: accounts.id,
      userId: accounts.userId,
      name: accounts.name,
      icon: accounts.icon,
      currency: accounts.currency,
      walletAddress: accounts.walletAddress,
      ownerName: users.name,
    })
    .from(accounts)
    .leftJoin(users, eq(accounts.userId, users.id))
    .where(eq(accounts.walletAddress, address));

  if (!row) return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });

  return NextResponse.json({
    id: row.id,
    name: row.name,
    icon: row.icon,
    currency: row.currency,
    walletAddress: row.walletAddress,
    ownerName: row.ownerName,
    isOwn: row.userId === userId,
  });
}
