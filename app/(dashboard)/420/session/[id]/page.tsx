import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { smokeSessions, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ActiveSessionClient } from "@/components/420/active-session-client";

const PRIVATE_EMAIL = "torresdevmx@gmail.com";

export const metadata = { title: "Sesión activa — Flow" };

export default async function ActiveSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.email !== PRIVATE_EMAIL) redirect("/dashboard");

  const { id } = await params;

  const [session] = await db
    .select()
    .from(smokeSessions)
    .where(and(eq(smokeSessions.id, id), eq(smokeSessions.userId, userId)));

  if (!session) notFound();
  if (session.status === "closed") redirect("/420");

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 min-h-screen">
      <ActiveSessionClient session={session} />
    </div>
  );
}
