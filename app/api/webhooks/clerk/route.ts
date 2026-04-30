import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { DEFAULT_ROLE_SEEDS } from "@/lib/permissions";

/** Siembra roles por defecto si la tabla está vacía */
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

/** Devuelve el nombre del rol marcado como default, o "client" como fallback */
async function getDefaultRoleName(): Promise<string> {
  const [defaultRole] = await db
    .select({ name: roles.name })
    .from(roles)
    .where(eq(roles.isDefault, true))
    .limit(1);
  return defaultRole?.name ?? "client";
}

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: "No webhook secret" }, { status: 500 });
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    // 400 aquí = firma inválida o timestamp > 5 min (reintento expirado o test del dashboard)
    console.warn("[webhook] Signature rejected (stale retry or test event):", (err as Error).message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { type, data } = evt;

  if (type === "user.created") {
    const { id, email_addresses, first_name, last_name, image_url } = data;
    const email = email_addresses[0]?.email_address ?? "";
    const name = [first_name, last_name].filter(Boolean).join(" ") || null;
    console.log("[webhook] user.created:", { id, email, name });

    // El primer usuario que se registra se convierte en admin automáticamente
    const [existingUser] = await db.select({ id: users.id }).from(users).limit(1);
    const isFirstUser = !existingUser;

    // Sembrar roles por defecto si no existen
    await seedDefaultRolesIfEmpty();

    const role = isFirstUser ? "admin" : await getDefaultRoleName();

    await db.insert(users).values({
      id, email, name, imageUrl: image_url, role,
    }).onConflictDoNothing();

    // Sincronizar rol a Clerk publicMetadata para que el JWT lo incluya
    const clerk = await clerkClient();
    await clerk.users.updateUserMetadata(id, { publicMetadata: { role } });
  }

  if (type === "user.updated") {
    const { id, email_addresses, first_name, last_name, image_url } = data;
    const email = email_addresses[0]?.email_address ?? "";
    const name = [first_name, last_name].filter(Boolean).join(" ") || null;

    // Solo actualiza datos de perfil, nunca sobreescribe el rol
    await db.update(users)
      .set({ email, name, imageUrl: image_url, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  if (type === "user.deleted") {
    if (data.id) {
      await db.delete(users).where(eq(users.id, data.id));
    }
  }

  return NextResponse.json({ received: true });
}
