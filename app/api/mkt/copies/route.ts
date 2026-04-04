import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { mktCopies } from "@/db/schema";
import { desc, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  type: z.enum(["whatsapp_msg", "email_subject", "email_body", "ig_dm", "script", "cta", "other"]).optional(),
  status: z.enum(["draft", "review", "approved", "active", "archived"]).optional(),
  abVariant: z.string().max(1).nullish(),
  parentId: z.string().uuid().nullish(),
  framework: z.enum(["AIDA", "PAS", "social_proof", "FOMO", "custom"]).nullish(),
  tone: z.string().nullish(),
  notes: z.string().nullish(),
});

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const excludeArchived = url.searchParams.get("excludeArchived") === "true";

  let rows;
  if (excludeArchived) {
    rows = await db.select().from(mktCopies)
      .where(ne(mktCopies.status, "archived"))
      .orderBy(desc(mktCopies.createdAt));
  } else {
    rows = await db.select().from(mktCopies)
      .orderBy(desc(mktCopies.createdAt));
  }

  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [copy] = await db
    .insert(mktCopies)
    .values({ ...parsed.data, createdBy: userId })
    .returning();

  return NextResponse.json(copy, { status: 201 });
}
