"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type CategoryOption = {
  id: string;
  name: string;
  color: string;
  icon: string;
  isSystem: boolean;
  isHidden: boolean;
};

interface CategoryPickerProps {
  value: string[];
  onChange: (ids: string[]) => void;
  categories?: CategoryOption[];  // si ya las tienes, pásalas; si no, las carga internamente
  maxItems?: number;
  label?: string;
}

export function CategoryPicker({
  value,
  onChange,
  categories: externalCats,
  maxItems = 4,
  label = "Categorías",
}: CategoryPickerProps) {
  const [cats, setCats] = useState<CategoryOption[]>(externalCats ?? []);

  useEffect(() => {
    if (externalCats) { setCats(externalCats); return; }
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: CategoryOption[]) => setCats(data.filter((c) => !c.isHidden)));
  }, [externalCats]);

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else if (value.length < maxItems) {
      onChange([...value, id]);
    }
  }

  const visible = cats.filter((c) => !c.isHidden);

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((cat) => {
          const selected = value.includes(cat.id);
          const disabled = !selected && value.length >= maxItems;
          return (
            <button
              key={cat.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(cat.id)}
              title={cat.name}
              className={cn(
                "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all",
                selected
                  ? "text-white border-transparent"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                disabled && "opacity-40 cursor-not-allowed",
              )}
              style={selected ? { backgroundColor: cat.color, borderColor: cat.color } : undefined}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>
      {value.length >= maxItems && (
        <p className="text-[10px] text-slate-400 mt-1">Máximo {maxItems} categorías por tarea</p>
      )}
    </div>
  );
}

/** Muestra dots de color de categorías en la card del kanban */
export function CategoryDots({ categories }: { categories: { id: string; name: string; color: string; icon: string }[] }) {
  if (!categories || categories.length === 0) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {categories.map((cat) => (
        <span
          key={cat.id}
          title={cat.name}
          className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium"
          style={{ backgroundColor: cat.color }}
        >
          {cat.icon} {cat.name}
        </span>
      ))}
    </div>
  );
}
