import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { journalEntries } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { JournalEditor } from "@/components/journal/journal-editor";

export const metadata = { title: "Diario — Uxuri" };

interface Props {
  searchParams: Promise<{ date?: string }>;
}

export default async function JournalPage({ searchParams }: Props) {
  const { userId } = await auth();
  if (!userId) return null;

  const { date } = await searchParams;
  const todayStr = new Date().toISOString().split("T")[0];
  const dateStr = date ?? todayStr;

  const [entry, recentEntries] = await Promise.all([
    db.select().from(journalEntries)
      .where(eq(journalEntries.userId, userId))
      .then((all) => all.find((e) => e.date === dateStr) ?? null),
    db.select({
      id: journalEntries.id,
      date: journalEntries.date,
      mood: journalEntries.mood,
      intention: journalEntries.intention,
      wins: journalEntries.wins,
    })
      .from(journalEntries)
      .where(eq(journalEntries.userId, userId))
      .orderBy(desc(journalEntries.date))
      .limit(14),
  ]);

  return (
    <div className="p-4 md:p-6">
      <JournalEditor
        initialEntry={entry}
        recentEntries={recentEntries}
        todayStr={todayStr}
        dateStr={dateStr}
      />
    </div>
  );
}
