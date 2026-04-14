import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  mealPlans, mealEntries,
  shoppingLists, shoppingItems,
  businesses, businessMembers,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callAI } from "@/lib/ai-call";

const CATEGORIES = [
  "frutas_verduras","carnes_mariscos","lacteos_huevos","panaderia","bebidas",
  "abarrotes","limpieza","higiene","congelados","farmacia","otro",
] as const;

const schema = z.object({
  weekStart:  z.string(),                               // YYYY-MM-DD del lunes
  listName:   z.string().min(1).max(200),               // nombre de la nueva lista
  businessId: z.string().uuid().nullable().optional(),  // para compartir
});

const DAY_LABELS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
const MEAL_LABELS: Record<string, string> = {
  desayuno: "Desayuno", comida: "Comida", cena: "Cena", snack: "Snack",
};

async function getUserBizIds(userId: string): Promise<string[]> {
  const [owned, member] = await Promise.all([
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId)),
    db.select({ businessId: businessMembers.businessId }).from(businessMembers).where(eq(businessMembers.userId, userId)),
  ]);
  return [...new Set([...owned.map((b) => b.id), ...member.map((m) => m.businessId)])];
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { weekStart, listName, businessId } = parsed.data;

  // Verify businessId belongs to user
  if (businessId) {
    const bizIds = await getUserBizIds(userId);
    if (!bizIds.includes(businessId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Fetch this week's meal entries
  const [plan] = await db
    .select({ id: mealPlans.id })
    .from(mealPlans)
    .where(and(eq(mealPlans.userId, userId), eq(mealPlans.weekStart, weekStart)));

  const entries = plan
    ? await db
        .select({ dayOfWeek: mealEntries.dayOfWeek, mealTime: mealEntries.mealTime, name: mealEntries.name })
        .from(mealEntries)
        .where(eq(mealEntries.planId, plan.id))
        .orderBy(mealEntries.dayOfWeek, mealEntries.mealTime)
    : [];

  if (entries.length === 0) {
    return NextResponse.json({ error: "No hay comidas planeadas esta semana" }, { status: 422 });
  }

  // Build prompt
  const mealList = entries.map((e) => {
    const day = DAY_LABELS[e.dayOfWeek] ?? `Día ${e.dayOfWeek}`;
    const meal = MEAL_LABELS[e.mealTime] ?? e.mealTime;
    return `- ${day} ${meal}: ${e.name}`;
  }).join("\n");

  const systemPrompt = `Eres un asistente experto en cocina mexicana. Extraes ingredientes de un plan de comidas para generar una lista de compras. Respondes SOLO con JSON válido, sin texto adicional ni bloques de código.`;

  const userMessage = `Plan de comidas de esta semana:
${mealList}

Genera la lista de ingredientes necesarios para preparar estos platillos. Instrucciones:
- Combina ingredientes similares (no repitas el mismo ingrediente)
- No incluyas condimentos muy básicos (sal, pimienta, aceite vegetal) a menos que el platillo sea muy específico
- Usa nombres simples y comunes en español mexicano
- La cantidad debe ser aproximada y práctica para ir al supermercado

Responde SOLO con este JSON (sin markdown, sin texto extra):
{"items":[{"name":"...","category":"frutas_verduras|carnes_mariscos|lacteos_huevos|panaderia|bebidas|abarrotes|limpieza|higiene|congelados|farmacia|otro","quantity":"..."}]}`;

  const aiResponse = await callAI({
    model: "gpt-4o-mini",
    systemPrompt,
    userMessage,
    maxTokens: 1200,
    temperature: 0.3,
  });

  if (!aiResponse) {
    return NextResponse.json({ error: "Error al conectar con la IA" }, { status: 502 });
  }

  // Parse AI response
  let aiItems: { name: string; category: string; quantity: string | null }[] = [];
  try {
    const raw = aiResponse.replace(/```json|```/g, "").trim();
    const parsed2 = JSON.parse(raw);
    aiItems = Array.isArray(parsed2.items) ? parsed2.items : [];
  } catch {
    return NextResponse.json({ error: "Respuesta IA inválida", raw: aiResponse }, { status: 502 });
  }

  // Validate categories
  const validItems = aiItems
    .filter((i) => i.name && typeof i.name === "string")
    .map((i) => ({
      name:     i.name.trim(),
      category: (CATEGORIES.includes(i.category as never) ? i.category : "otro") as typeof CATEGORIES[number],
      quantity: i.quantity?.trim() || null,
    }));

  if (validItems.length === 0) {
    return NextResponse.json({ error: "La IA no pudo extraer ingredientes" }, { status: 422 });
  }

  // Create the shopping list
  const [list] = await db
    .insert(shoppingLists)
    .values({
      userId,
      name:       listName,
      businessId: businessId ?? null,
      weekStart,
    })
    .returning();

  // Insert all items
  const insertedItems = await db
    .insert(shoppingItems)
    .values(validItems.map((item, i) => ({
      listId:    list.id,
      name:      item.name,
      category:  item.category,
      quantity:  item.quantity,
      sortOrder: i,
    })))
    .returning();

  return NextResponse.json({
    list: { ...list, itemCount: insertedItems.length, doneCount: 0 },
    items: insertedItems,
  }, { status: 201 });
}
