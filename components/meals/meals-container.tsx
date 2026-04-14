"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { UtensilsCrossed, ShoppingCart } from "lucide-react";
import { MealPlanner, type MealEntryRow } from "./meal-planner";
import { ShoppingList, type ShoppingListRow, type BusinessOption } from "./shopping-list";

type Tab = "planeacion" | "compras";

export function MealsContainer({
  // Meal planner props
  initialEntries,
  initialWeekStart,
  // Shopping list props
  initialLists,
  businesses,
}: {
  initialEntries: MealEntryRow[];
  initialWeekStart: string;
  initialLists: ShoppingListRow[];
  businesses: BusinessOption[];
}) {
  const [tab, setTab] = useState<Tab>("planeacion");

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "planeacion", label: "Planeación semanal", icon: <UtensilsCrossed className="w-4 h-4" /> },
    { id: "compras",    label: "Lista de compras",   icon: <ShoppingCart className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-5">
      {/* Tab nav */}
      <div className="flex gap-1 bg-slate-50 rounded-xl p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content — both panels stay mounted to preserve state across tab switches */}
      <div className={tab !== "planeacion" ? "hidden" : ""}>
        <MealPlanner
          initialEntries={initialEntries}
          initialWeekStart={initialWeekStart}
        />
      </div>

      <div className={tab !== "compras" ? "hidden" : ""}>
        <ShoppingList
          initialLists={initialLists}
          businesses={businesses}
          weekStart={initialWeekStart}
          weekEntries={initialEntries}
        />
      </div>
    </div>
  );
}
