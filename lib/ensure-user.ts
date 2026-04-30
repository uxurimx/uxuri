import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { DEFAULT_ROLE_SEEDS } from "@/lib/permissions";

async function seedDefaultRolesIfEmpty() {
  const [anyRole] = await db.select({ id: roles.id }).from(roles).limit(1);
  if (anyRole) return;
  for (const seed of DEFAULT_ROLE_SEEDS) {
    await db.insert(roles).values({
      name: seed.name,
      label: seed.label,
      permissions: [...seed.permissions],
      isDefault: seed.isDefault,
    }).onConflictDoNothing();
  }
}

async function getDefaultRoleName(): Promise<string> {
  const [defaultRole] = await db
    .select({ name: roles.name })
    .from(roles)
    .where(eq(roles.isDefault, true))
    .limit(1);
  return defaultRole?.name ?? "client";
}

/**
 * Upserts the current Clerk user into the DB and syncs role to Clerk publicMetadata.
 * Fallback for when the webhook hasn't fired (e.g. local dev without a tunnel).
 */
export async function ensureUser(userId: string): Promise<void> {
  const clerkUser = await currentUser();
  if (!clerkUser) return;

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

  const [anyUser] = await db.select({ id: users.id }).from(users).limit(1);
  const isFirstUser = !anyUser;

  await seedDefaultRolesIfEmpty();

  const role = isFirstUser ? "admin" : await getDefaultRoleName();

  const inserted = await db.insert(users).values({
    id: userId,
    email,
    name,
    imageUrl: clerkUser.imageUrl,
    role,
  }).onConflictDoNothing().returning({ id: users.id });

  if (inserted.length > 0) {
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(userId, { publicMetadata: { role } });
  }
}
