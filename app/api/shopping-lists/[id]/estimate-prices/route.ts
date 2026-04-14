import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { shoppingLists, shoppingItems, businesses, businessMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { callAI } from "@/lib/ai-call";

async function getUserBizIds(userId: string): Promise<string[]> {
  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);
  return [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];
}

async function canAccess(listId: string, userId: string) {
  const [list] = await db.select().from(shoppingLists).where(eq(shoppingLists.id, listId));
  if (!list) return null;
  if (list.userId === userId) return list;
  if (list.businessId) {
    const bizIds = await getUserBizIds(userId);
    if (bizIds.includes(list.businessId)) return list;
  }
  return false;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const access = await canAccess(id, userId);
  if (access === null)  return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (access === false) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Parse optional body: { all?: boolean } — if all=true, re-estimate items that already have a price too
  const body = await req.json().catch(() => ({}));
  const estimateAll = body?.all === true;

  const allItems = await db
    .select()
    .from(shoppingItems)
    .where(eq(shoppingItems.listId, id))
    .orderBy(shoppingItems.sortOrder, shoppingItems.createdAt);

  const targets = estimateAll
    ? allItems
    : allItems.filter((i) => !i.estimatedPrice);

  if (targets.length === 0) {
    return NextResponse.json({ updated: [], skipped: allItems.length });
  }

  // Build AI prompt
  const itemLines = targets
    .map((item, i) => `${i + 1}. ${item.name}${item.quantity ? ` (${item.quantity})` : ""}`)
    .join("\n");

  const systemPrompt = `Eres un experto en precios de supermercados en México (Walmart, Soriana, Chedraui, La Comer, Costco México). Respondes SOLO con JSON válido, sin texto adicional ni bloques de código.`;

  const userMessage = `Estima el precio unitario en pesos mexicanos (MXN) para cada producto. Usa precios típicos de 2024 en México. Si un producto tiene cantidad especificada, estima el precio para esa cantidad.

Productos:
${itemLines}

Responde SOLO con este JSON (sin markdown):
{"items":[{"index":1,"price":25.50},{"index":2,"price":85.00},...]}`;

  const aiResponse = await callAI({
    model: "gpt-4o-mini",
    systemPrompt,
    userMessage,
    maxTokens: 600,
    temperature: 0.2,
  });

  if (!aiResponse) {
    return NextResponse.json({ error: "Error al conectar con la IA" }, { status: 502 });
  }

  // Parse AI response
  let aiPrices: { index: number; price: number }[] = [];
  try {
    const raw = aiResponse.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(raw);
    aiPrices = Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return NextResponse.json({ error: "Respuesta IA inválida", raw: aiResponse }, { status: 502 });
  }

  // Update items with estimated prices
  const updated: typeof allItems = [];
  for (const entry of aiPrices) {
    const item = targets[entry.index - 1];
    if (!item || typeof entry.price !== "number" || entry.price <= 0) continue;
    const [updatedItem] = await db
      .update(shoppingItems)
      .set({ estimatedPrice: entry.price.toFixed(2), updatedAt: new Date() })
      .where(eq(shoppingItems.id, item.id))
      .returning();
    if (updatedItem) updated.push(updatedItem);
  }

  return NextResponse.json({ updated, skipped: allItems.length - targets.length });
}
