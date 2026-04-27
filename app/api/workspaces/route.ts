import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  workspaces,
  workspaceMembers,
  workspaceProfiles,
  workspaceMemberProfiles,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureUser } from "@/lib/ensure-user";
import { getUserWorkspaces } from "@/lib/workspace";

const createSchema = z.object({
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/i, "slug debe ser alfanumérico con guiones"),
  type: z.enum(["personal", "business"]).default("business"),
  description: z.string().optional(),
  brandName: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureUser(userId);

  const list = await getUserWorkspaces(userId);
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureUser(userId);

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Slug único
  const [existing] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.slug, parsed.data.slug.toLowerCase()))
    .limit(1);
  if (existing) {
    return NextResponse.json({ error: "Slug ya existe" }, { status: 409 });
  }

  const [ws] = await db
    .insert(workspaces)
    .values({
      ...parsed.data,
      slug: parsed.data.slug.toLowerCase(),
      ownerId: userId,
    })
    .returning();

  // Owner membership
  const [member] = await db
    .insert(workspaceMembers)
    .values({ workspaceId: ws.id, userId, isOwner: true })
    .returning();

  // Perfil "Admin" por defecto en el nuevo workspace
  const allRoutes = [
    "/dashboard", "/clients", "/clients/pipeline", "/projects", "/tasks",
    "/today", "/agents", "/objectives", "/planning", "/habits", "/journal",
    "/notes", "/schedule", "/review", "/chat", "/users", "/finanzas",
    "/comidas", "/negocios", "/marketing", "/settings", "/workspaces",
  ];
  const [adminProfile] = await db
    .insert(workspaceProfiles)
    .values({
      workspaceId: ws.id,
      name: "admin",
      label: "Admin",
      description: "Acceso total al workspace",
      color: "#b91c1c",
      icon: "👑",
      permissions: allRoutes,
      defaultRoute: "/dashboard",
      isSystem: true,
    })
    .returning();

  await db.insert(workspaceMemberProfiles).values({
    memberId: member.id,
    profileId: adminProfile.id,
    isDefault: true,
  });

  return NextResponse.json(ws, { status: 201 });
}
