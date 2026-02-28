import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Upserts the current Clerk user into the DB and syncs role to Clerk publicMetadata.
 * Fallback for when the webhook hasn't fired (e.g. local dev without a tunnel).
 */
export async function ensureUser(userId: string): Promise<void> {
  const clerkUser = await currentUser();
  if (!clerkUser) return;

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

  // El primer usuario que llega (sin webhook) se convierte en admin
  const [anyUser] = await db.select({ id: users.id }).from(users).limit(1);
  const role = anyUser ? "client" : "admin";

  const inserted = await db.insert(users).values({
    id: userId,
    email,
    name,
    imageUrl: clerkUser.imageUrl,
    role,
  }).onConflictDoNothing().returning({ id: users.id });

  // Solo sincroniza Clerk si realmente se insertó (primera vez)
  if (inserted.length > 0) {
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(userId, { publicMetadata: { role } });
  }
}
