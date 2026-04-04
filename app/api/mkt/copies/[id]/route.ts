import { NextResponse } from "next/server";
import { db } from "@/db";
import { mktCopies } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateMktApiKey, unauthorizedResponse } from "@/lib/mkt-auth";
import { auth } from "@clerk/nextjs/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKeyValid = validateMktApiKey(req);
  if (!apiKeyValid) {
    const { userId } = await auth();
    if (!userId) return unauthorizedResponse();
  }

  const { id } = await params;
  const [copy] = await db.select().from(mktCopies).where(eq(mktCopies.id, id));
  if (!copy) return NextResponse.json({ error: "Copy no encontrado" }, { status: 404 });

  return NextResponse.json(copy);
}
