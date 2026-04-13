import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, projectPayments } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccess } from "@/lib/access";

const createPaymentSchema = z.object({
  concept: z.string().min(1).max(500),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Monto inválido"),
  currency: z.string().max(10).default("MXN"),
  type: z.enum(["anticipo", "abono", "pago_final", "reembolso", "otro"]).default("abono"),
  status: z.enum(["pending", "paid", "overdue", "cancelled"]).default("pending"),
  method: z.enum(["transferencia", "efectivo", "tarjeta", "paypal", "crypto", "otro"]).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  paidAt: z.string().optional().nullable(),
  phaseId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  reference: z.string().max(255).optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [project] = await db
    .select({ createdBy: projects.createdBy, privacy: projects.privacy })
    .from(projects)
    .where(eq(projects.id, id));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hasAccess =
    project.privacy === "public" ||
    (await canAccess(userId, "project", id, project.createdBy, "view"));
  if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payments = await db
    .select()
    .from(projectPayments)
    .where(eq(projectPayments.projectId, id))
    .orderBy(desc(projectPayments.createdAt));

  return NextResponse.json(payments);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const [project] = await db
    .select({ createdBy: projects.createdBy, clientId: projects.clientId })
    .from(projects)
    .where(eq(projects.id, id));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canAccess(userId, "project", id, project.createdBy, "edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createPaymentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [payment] = await db
    .insert(projectPayments)
    .values({
      projectId: id,
      clientId: parsed.data.clientId ?? project.clientId,
      ...parsed.data,
      paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : null,
      createdBy: userId,
    })
    .returning();

  return NextResponse.json(payment, { status: 201 });
}
