import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { projects, projectPayments, transactions, accounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccess } from "@/lib/access";
import { localDateStr } from "@/lib/date";

const updatePaymentSchema = z.object({
  concept: z.string().min(1).max(500).optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  currency: z.string().max(10).optional(),
  type: z.enum(["anticipo", "abono", "pago_final", "reembolso", "otro"]).optional(),
  status: z.enum(["pending", "paid", "overdue", "cancelled"]).optional(),
  method: z.enum(["transferencia", "efectivo", "tarjeta", "paypal", "crypto", "otro"]).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  paidAt: z.string().optional().nullable(),
  phaseId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  reference: z.string().max(255).optional().nullable(),
  // Para crear la transacción real en finanzas
  accountId: z.string().uuid().optional().nullable(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, pid } = await params;
  const [project] = await db
    .select({
      createdBy: projects.createdBy,
      clientId: projects.clientId,
      businessId: projects.businessId,
      name: projects.name,
    })
    .from(projects)
    .where(eq(projects.id, id));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canAccess(userId, "project", id, project.createdBy, "edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updatePaymentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Cargar payment actual para saber si ya estaba paid
  const [currentPayment] = await db
    .select()
    .from(projectPayments)
    .where(and(eq(projectPayments.id, pid), eq(projectPayments.projectId, id)));
  if (!currentPayment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { accountId, ...paymentData } = parsed.data;
  const updateData: Record<string, unknown> = { ...paymentData, updatedAt: new Date() };
  if (paymentData.paidAt !== undefined) {
    updateData.paidAt = paymentData.paidAt ? new Date(paymentData.paidAt) : null;
  }

  const [payment] = await db
    .update(projectPayments)
    .set(updateData)
    .where(and(eq(projectPayments.id, pid), eq(projectPayments.projectId, id)))
    .returning();

  // ── Crear transacción real cuando se marca como pagado ────────────────────
  if (
    parsed.data.status === "paid" &&
    currentPayment.status !== "paid" &&
    accountId
  ) {
    const paidAmount = parsed.data.amount ?? currentPayment.amount;
    const paidCurrency = parsed.data.currency ?? currentPayment.currency;
    const paidAt = updateData.paidAt as Date | null ?? new Date();
    const concept = parsed.data.concept ?? currentPayment.concept;

    await db.insert(transactions).values({
      userId,
      accountId,
      type: "income",
      amount: paidAmount,
      currency: (paidCurrency as "MXN" | "USD" | "EUR"),
      description: `${concept} — ${project.name}`,
      date: localDateStr(paidAt),
      status: "completed",
      clientId: currentPayment.clientId ?? project.clientId,
      projectId: id,
      businessId: project.businessId ?? undefined,
      notes: currentPayment.notes ?? undefined,
      category: "client_payment",
    });
  }

  return NextResponse.json(payment);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, pid } = await params;
  const [project] = await db
    .select({ createdBy: projects.createdBy })
    .from(projects)
    .where(eq(projects.id, id));
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await canAccess(userId, "project", id, project.createdBy, "edit"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db
    .delete(projectPayments)
    .where(and(eq(projectPayments.id, pid), eq(projectPayments.projectId, id)));

  return NextResponse.json({ ok: true });
}
