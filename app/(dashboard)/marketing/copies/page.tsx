import { db } from "@/db";
import { mktCopies } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireAccess } from "@/lib/auth";
import { CopiesList } from "@/components/marketing/copies-list";

export default async function CopiesPage() {
  await requireAccess("/marketing");

  const copies = await db
    .select()
    .from(mktCopies)
    .orderBy(desc(mktCopies.createdAt));

  const serialized = copies.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  return <CopiesList initialCopies={serialized} />;
}
