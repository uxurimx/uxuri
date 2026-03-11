import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { notes } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NotesClient } from "@/components/notes/notes-client";

export const metadata = { title: "Notas — Uxuri" };

export default async function NotesPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const allNotes = await db
    .select()
    .from(notes)
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.isPinned), desc(notes.updatedAt))
    .limit(100);

  return (
    <div className="p-4 md:p-6">
      <NotesClient initialNotes={allNotes.map((n) => ({
        ...n,
        updatedAt: n.updatedAt.toISOString(),
      }))} />
    </div>
  );
}
