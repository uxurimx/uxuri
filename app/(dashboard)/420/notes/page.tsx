import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { GlobalNotesClient } from "@/components/420/global-notes-client";

const PRIVATE_EMAIL = "torresdevmx@gmail.com";

export const metadata = { title: "Notas — Flow" };

export default async function Notes420Page() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user || user.email !== PRIVATE_EMAIL) redirect("/dashboard");

  return (
    <div className="-m-4 md:-m-6 lg:-m-8 min-h-screen">
      <GlobalNotesClient color="#00c896" />
    </div>
  );
}
