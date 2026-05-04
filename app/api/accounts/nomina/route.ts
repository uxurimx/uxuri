import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { accounts, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// Returns ALL nomina accounts in the system (no balances — just enough to send a transfer)
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      id: accounts.id,
      userId: accounts.userId,
      name: accounts.name,
      icon: accounts.icon,
      currency: accounts.currency,
      walletAddress: accounts.walletAddress,
      businessId: accounts.businessId,
      ownerName: users.name,
    })
    .from(accounts)
    .leftJoin(users, eq(accounts.userId, users.id))
    .where(eq(accounts.type, "nomina"))
    .orderBy(accounts.name);

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      currency: r.currency,
      walletAddress: r.walletAddress,
      businessId: r.businessId,
      ownerName: r.ownerName,
      isOwn: r.userId === userId,
    }))
  );
}
