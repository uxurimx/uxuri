"use client";

import { useState, useRef, useEffect, useTransition, useCallback } from "react";
import {
  Plus, X, Trash2, Check, ShoppingCart, ChevronDown, Pencil,
  Building2, Archive, RotateCcw, Sparkles, Copy, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type ListStatus = "active" | "done" | "archived";

type ShoppingItemCategory =
  | "frutas_verduras" | "carnes_mariscos" | "lacteos_huevos" | "panaderia"
  | "bebidas" | "abarrotes" | "limpieza" | "higiene" | "congelados"
  | "farmacia" | "otro";

export type ShoppingListRow = {
  id: string;
  userId: string;
  businessId: string | null;
  name: string;
  weekStart: string | null;
  status: ListStatus;
  notes: string | null;
  itemCount: number;
  doneCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ShoppingItemRow = {
  id: string;
  listId: string;
  name: string;
  category: ShoppingItemCategory;
  quantity: string | null;
  estimatedPrice: string | null;
  notes: string | null;
  isDone: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type BusinessOption = { id: string; name: string; logo: string | null };

// Simplified meal entry (for generate feature)
export type MealEntryRef = {
  dayOfWeek: number;
  mealTime: string;
  name: string;
};

type Suggestion = { name: string; category: ShoppingItemCategory; quantity: string | null };

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<ShoppingItemCategory, { label: string; emoji: string; color: string }> = {
  frutas_verduras:  { label: "Frutas y verduras",  emoji: "🥕", color: "text-green-700" },
  carnes_mariscos:  { label: "Carnes y mariscos",  emoji: "🥩", color: "text-red-700" },
  lacteos_huevos:   { label: "Lácteos y huevos",   emoji: "🥛", color: "text-yellow-700" },
  panaderia:        { label: "Panadería",           emoji: "🍞", color: "text-amber-700" },
  bebidas:          { label: "Bebidas",             emoji: "🧃", color: "text-blue-700" },
  abarrotes:        { label: "Abarrotes",           emoji: "🛒", color: "text-slate-700" },
  limpieza:         { label: "Limpieza",            emoji: "🧹", color: "text-cyan-700" },
  higiene:          { label: "Higiene",             emoji: "🧴", color: "text-purple-700" },
  congelados:       { label: "Congelados",          emoji: "❄️", color: "text-sky-700" },
  farmacia:         { label: "Farmacia",            emoji: "💊", color: "text-rose-700" },
  otro:             { label: "Otro",                emoji: "📦", color: "text-slate-500" },
};

const CATEGORIES = Object.keys(CATEGORY_CONFIG) as ShoppingItemCategory[];

// ── Auto-detect category from item name ───────────────────────────────────────

function guessCategory(name: string): ShoppingItemCategory {
  const n = name.toLowerCase();
  if (/manzana|naranja|limón|limon|plátano|platano|uva|pera|mango|fresa|kiwi|papaya|sandía|sandia|melón|melon|aguacate|tomate|jitomate|cebolla|ajo|zanahoria|papa|chayote|calabaza|lechuga|espinaca|brócoli|brocoli|coliflor|chile|nopales|cilantro|perejil|verdura|fruta|ejote|betabel|pepino|rábano|rabano/.test(n)) return "frutas_verduras";
  if (/carne|pollo|res|puerco|cerdo|pescado|atún|atun|camarón|camaron|filete|chuleta|chorizo|salchicha|jamón|jamon|milanesa|bistec|molida|costilla/.test(n)) return "carnes_mariscos";
  if (/leche|queso|yogur|yogurt|crema|mantequilla|huevo/.test(n)) return "lacteos_huevos";
  if (/pan|tortilla|telera|baguette|galleta|pastel|bizcocho|concha|cuernito/.test(n)) return "panaderia";
  if (/agua|refresco|jugo|cerveza|vino|café|cafe|té|te|bebida|limonada|naranjada/.test(n)) return "bebidas";
  if (/arroz|frijol|lenteja|garbanzo|pasta|harina|azúcar|azucar|sal|aceite|vinagre|salsa|mayonesa|ketchup|mostaza|atún|atun|sardina|mole|consomé|consome/.test(n)) return "abarrotes";
  if (/jabón|jabon|detergente|cloro|fabuloso|pinol|fibra|esponja|bolsa|escoba|jerga|trapeador|paño/.test(n)) return "limpieza";
  if (/shampoo|acondicionador|dental|cepillo|desodorante|higiénico|higienico|toalla|pañal|panal|rastrillo/.test(n)) return "higiene";
  if (/helado|congelad|nugget|empanada/.test(n)) return "congelados";
  if (/aspirina|paracetamol|ibuprofeno|vitamina|medicamento|pastilla|jarabe|vick|pomada/.test(n)) return "farmacia";
  return "otro";
}

// ── New List Modal ────────────────────────────────────────────────────────────

function NewListModal({
  businesses,
  onClose,
  onCreate,
}: {
  businesses: BusinessOption[];
  onClose: () => void;
  onCreate: (list: ShoppingListRow) => void;
}) {
  const [name, setName] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/shopping-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), businessId: businessId || null }),
    });
    if (res.ok) {
      onCreate(await res.json());
      onClose();
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Nueva lista</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Despensa semana, Hogar limpieza…"
              required
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {businesses.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Compartir con negocio (opcional)</label>
              <select
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Solo yo —</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {businessId && (
                <p className="text-xs text-amber-600 mt-1">Todos los miembros podrán ver y editar esta lista.</p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-4 py-2 text-sm bg-[#1e3a5f] text-white rounded-lg hover:bg-[#162d4a] disabled:opacity-50 transition-colors"
            >
              {saving ? "Creando…" : "Crear lista"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Generate Modal (AI) ───────────────────────────────────────────────────────

const GEN_DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const GEN_MEAL_LABELS: Record<string, string> = {
  desayuno: "Desayuno", comida: "Comida", cena: "Cena", snack: "Snack",
};

function GenerateModal({
  businesses,
  weekStart,
  weekEntries,
  onClose,
  onGenerated,
}: {
  businesses: BusinessOption[];
  weekStart: string;
  weekEntries: MealEntryRef[];
  onClose: () => void;
  onGenerated: (list: ShoppingListRow) => void;
}) {
  const weekDate = new Date(weekStart + "T00:00:00");
  const weekLabel = weekDate.toLocaleDateString("es-MX", { day: "numeric", month: "long" });

  const [listName, setListName] = useState(`Despensa semana del ${weekLabel}`);
  const [businessId, setBusinessId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/shopping-lists/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weekStart,
        listName: listName.trim() || `Despensa semana del ${weekLabel}`,
        businessId: businessId || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Error al generar");
      setLoading(false);
      return;
    }
    onGenerated(data.list);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            <h2 className="font-semibold text-slate-900">Generar lista con IA</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">
              Comidas planeadas esta semana ({weekEntries.length})
            </p>
            <div className="bg-slate-50 rounded-xl p-3 max-h-44 overflow-y-auto space-y-1">
              {weekEntries.map((e, i) => (
                <div key={i} className="flex gap-2 text-xs text-slate-600">
                  <span className="text-slate-400 w-28 flex-shrink-0">
                    {GEN_DAY_LABELS[e.dayOfWeek]} · {GEN_MEAL_LABELS[e.mealTime] ?? e.mealTime}
                  </span>
                  <span className="font-medium">{e.name}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-violet-600 mt-2">
              La IA extraerá los ingredientes y los organizará por categoría.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre de la lista</label>
            <input
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {businesses.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Compartir con negocio (opcional)
              </label>
              <select
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">— Solo yo —</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading || !listName.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? "Generando…" : "Generar lista"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Quick Add Form (with autocomplete) ───────────────────────────────────────

function QuickAddForm({
  listId,
  onAdded,
}: {
  listId: string;
  onAdded: (item: ShoppingItemRow) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ShoppingItemCategory>("otro");
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSugg, setShowSugg] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleNameChange(v: string) {
    setName(v);
    if (v.length >= 3) setCategory(guessCategory(v));

    // Debounced suggestions fetch
    if (timerRef.current) clearTimeout(timerRef.current);
    if (v.length >= 2) {
      timerRef.current = setTimeout(async () => {
        const res = await fetch(`/api/shopping-lists/suggestions?q=${encodeURIComponent(v)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
          setShowSugg(data.length > 0);
        }
      }, 250);
    } else {
      setSuggestions([]);
      setShowSugg(false);
    }
  }

  function applySuggestion(s: Suggestion) {
    setName(s.name);
    setCategory(s.category);
    if (s.quantity) setQuantity(s.quantity);
    setShowSugg(false);
    inputRef.current?.focus();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setShowSugg(false);
    const res = await fetch(`/api/shopping-lists/${listId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), category, quantity: quantity.trim() || null }),
    });
    if (res.ok) {
      onAdded(await res.json());
      setName("");
      setQuantity("");
      setCategory("otro");
      setSuggestions([]);
      inputRef.current?.focus();
    }
    setSaving(false);
  }

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="flex gap-2 items-center bg-white border border-slate-200 rounded-xl p-2 shadow-sm">
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          onBlur={() => setTimeout(() => setShowSugg(false), 150)}
          onFocus={() => suggestions.length > 0 && setShowSugg(true)}
          placeholder="Agregar producto…"
          className="flex-1 px-2 py-1.5 text-sm focus:outline-none"
          autoComplete="off"
        />
        <input
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Cantidad"
          className="w-24 px-2 py-1.5 text-sm border-l border-slate-100 focus:outline-none"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ShoppingItemCategory)}
          className="text-sm border-l border-slate-100 px-2 py-1.5 focus:outline-none bg-transparent"
          title="Categoría"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_CONFIG[c].emoji} {CATEGORY_CONFIG[c].label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex items-center gap-1 px-3 py-1.5 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] disabled:opacity-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>

      {/* Suggestions dropdown */}
      {showSugg && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => applySuggestion(s)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 text-left transition-colors"
            >
              <span className="text-base">{CATEGORY_CONFIG[s.category]?.emoji ?? "📦"}</span>
              <span className="flex-1 text-slate-800">{s.name}</span>
              {s.quantity && <span className="text-xs text-slate-400">{s.quantity}</span>}
              <span className="text-xs text-slate-300">historial</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Item Row ──────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  onToggle,
  onDelete,
  onEdit,
}: {
  item: ShoppingItemRow;
  onToggle: (id: string, isDone: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (item: ShoppingItemRow) => void;
}) {
  const cfg = CATEGORY_CONFIG[item.category];

  return (
    <div className={cn(
      "group flex items-center gap-3 py-2.5 px-1 rounded-lg transition-colors hover:bg-slate-50",
      item.isDone && "opacity-50"
    )}>
      {/* Checkbox */}
      <button
        onClick={() => onToggle(item.id, !item.isDone)}
        className={cn(
          "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
          item.isDone
            ? "bg-emerald-500 border-emerald-500"
            : "border-slate-300 hover:border-emerald-400"
        )}
      >
        {item.isDone && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </button>

      {/* Name + quantity */}
      <div className="flex-1 min-w-0">
        <span className={cn("text-sm text-slate-900", item.isDone && "line-through text-slate-400")}>
          {item.name}
        </span>
        {item.quantity && (
          <span className="text-xs text-slate-400 ml-1.5">{item.quantity}</span>
        )}
        {item.notes && (
          <p className="text-xs text-slate-400 truncate">{item.notes}</p>
        )}
      </div>

      {/* Price */}
      {item.estimatedPrice && (
        <span className="text-xs text-slate-400 tabular-nums flex-shrink-0">
          ${parseFloat(item.estimatedPrice).toLocaleString("es-MX", { minimumFractionDigits: 0 })}
        </span>
      )}

      {/* Actions (visible on hover) */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(item)}
          className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Edit Item Modal ───────────────────────────────────────────────────────────

function EditItemModal({
  item,
  onClose,
  onSaved,
}: {
  item: ShoppingItemRow;
  onClose: () => void;
  onSaved: (updated: ShoppingItemRow) => void;
}) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState<ShoppingItemCategory>(item.category);
  const [quantity, setQuantity] = useState(item.quantity ?? "");
  const [price, setPrice] = useState(item.estimatedPrice ? parseFloat(item.estimatedPrice).toString() : "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/shopping-lists/${item.listId}/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        category,
        quantity: quantity.trim() || null,
        estimatedPrice: price ? parseFloat(price) : null,
        notes: notes.trim() || null,
      }),
    });
    if (res.ok) {
      onSaved(await res.json());
      onClose();
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Editar producto</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cantidad</label>
              <input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="2 kg, 1 litro…"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Precio est.</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ShoppingItemCategory)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_CONFIG[c].emoji} {CATEGORY_CONFIG[c].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Marca, preferencia…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-4 py-2 text-sm bg-[#1e3a5f] text-white rounded-lg hover:bg-[#162d4a] disabled:opacity-50 transition-colors"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit List Modal ───────────────────────────────────────────────────────────

function EditListModal({
  list,
  businesses,
  onClose,
  onSaved,
}: {
  list: ShoppingListRow;
  businesses: BusinessOption[];
  onClose: () => void;
  onSaved: (updated: Partial<ShoppingListRow>) => void;
}) {
  const [name, setName] = useState(list.name);
  const [notes, setNotes] = useState(list.notes ?? "");
  const [businessId, setBusinessId] = useState(list.businessId ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/shopping-lists/${list.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        notes: notes.trim() || null,
        businessId: businessId || null,
      }),
    });
    if (res.ok) {
      onSaved({ name: name.trim(), notes: notes.trim() || null, businessId: businessId || null });
      onClose();
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Editar lista</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nombre *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Instrucciones o comentarios para la lista…"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          {businesses.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Compartir con negocio</label>
              <select
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Solo yo —</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {businessId && (
                <p className="text-xs text-amber-600 mt-1">
                  Todos los miembros del negocio podrán ver y editar esta lista.
                </p>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-4 py-2 text-sm bg-[#1e3a5f] text-white rounded-lg hover:bg-[#162d4a] disabled:opacity-50 transition-colors"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Active List View ──────────────────────────────────────────────────────────

function ActiveListView({
  list,
  businesses,
  onListUpdate,
  onListCloned,
}: {
  list: ShoppingListRow;
  businesses: BusinessOption[];
  onListUpdate: (updated: ShoppingListRow) => void;
  onListCloned: (cloned: ShoppingListRow) => void;
}) {
  const [items, setItems] = useState<ShoppingItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<ShoppingItemRow | null>(null);
  const [editingList, setEditingList] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [, startTransition] = useTransition();

  // Fetch items when list changes and sync counts from actual DB data
  useEffect(() => {
    setLoading(true);
    fetch(`/api/shopping-lists/${list.id}/items`)
      .then((r) => r.json())
      .then((data: ShoppingItemRow[]) => {
        setItems(data);
        setLoading(false);
        // Always sync counts from DB — SSR data or prior optimistic updates may be stale
        const itemCount = data.length;
        const doneCount = data.filter((i) => i.isDone).length;
        onListUpdate({ ...list, itemCount, doneCount });
      });
  // list.id is the only dep that should trigger a re-fetch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.id]);

  async function handleToggle(itemId: string, isDone: boolean) {
    // Optimistic
    setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, isDone } : i));
    const doneCount = items.filter((i) => (i.id === itemId ? isDone : i.isDone)).length;
    onListUpdate({ ...list, doneCount });

    await fetch(`/api/shopping-lists/${list.id}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDone }),
    });
  }

  async function handleDelete(itemId: string) {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    onListUpdate({ ...list, itemCount: list.itemCount - 1 });
    await fetch(`/api/shopping-lists/${list.id}/items/${itemId}`, { method: "DELETE" });
  }

  function handleAdded(item: ShoppingItemRow) {
    setItems((prev) => [...prev, item]);
    onListUpdate({ ...list, itemCount: list.itemCount + 1 });
  }

  function handleItemSaved(updated: ShoppingItemRow) {
    setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i));
    setEditingItem(null);
  }

  async function handleClone() {
    const res = await fetch(`/api/shopping-lists/${list.id}/clone`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      onListCloned(data.list);
    }
  }

  async function handleEstimatePrices(all = false) {
    setEstimating(true);
    const res = await fetch(`/api/shopping-lists/${list.id}/estimate-prices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.updated) && data.updated.length > 0) {
        setItems((prev) => prev.map((item) => {
          const fresh = (data.updated as ShoppingItemRow[]).find((u) => u.id === item.id);
          return fresh ?? item;
        }));
      }
    }
    setEstimating(false);
  }

  async function handleArchive() {
    const newStatus: ListStatus = list.status === "archived" ? "active" : "archived";
    const res = await fetch(`/api/shopping-lists/${list.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) onListUpdate({ ...list, status: newStatus });
  }

  async function handleMarkDone() {
    const res = await fetch(`/api/shopping-lists/${list.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    if (res.ok) onListUpdate({ ...list, status: "done" });
  }

  // Group items by category (pending first, done last)
  const pending = items.filter((i) => !i.isDone);
  const done    = items.filter((i) => i.isDone);

  const grouped = CATEGORIES
    .map((cat) => ({
      cat,
      items: pending.filter((i) => i.category === cat),
    }))
    .filter((g) => g.items.length > 0);

  const biz = businesses.find((b) => b.id === list.businessId);
  const pct = list.itemCount > 0 ? Math.round((list.doneCount / list.itemCount) * 100) : 0;

  // Price aggregates (from local items state, always fresh)
  const estimatedTotal = items.reduce((sum, i) => sum + (i.estimatedPrice ? parseFloat(i.estimatedPrice) : 0), 0);
  const unpricedPending = items.filter((i) => !i.isDone && !i.estimatedPrice).length;

  return (
    <div className="space-y-4">
      {/* List header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-slate-900 text-lg truncate">{list.name}</h2>
              {biz && (
                <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                  <Building2 className="w-3 h-3" />
                  {biz.name}
                </span>
              )}
              {list.status === "done" && (
                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Completada</span>
              )}
              {list.status === "archived" && (
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Archivada</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {list.doneCount} de {list.itemCount} productos
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {list.status === "active" && list.itemCount > 0 && (
              <button
                onClick={handleMarkDone}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                Listo
              </button>
            )}
            <button
              onClick={() => setEditingList(true)}
              title="Editar lista"
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={handleClone}
              title="Clonar como plantilla"
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={handleArchive}
              title={list.status === "archived" ? "Restaurar" : "Archivar"}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              {list.status === "archived" ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {list.itemCount > 0 && (
          <div className="mt-3">
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  pct === 100 ? "bg-emerald-500" : "bg-[#1e3a5f]"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Estimated total + price estimation */}
        {items.length > 0 && (
          <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              {estimatedTotal > 0 ? (
                <>
                  <span className="text-xs text-slate-500">Total estimado:</span>
                  <span className="text-sm font-semibold text-[#1e3a5f]">
                    {estimatedTotal.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-400">Sin precios estimados</span>
              )}
              {estimatedTotal > 0 && unpricedPending > 0 && (
                <span className="text-xs text-slate-400">({unpricedPending} sin precio)</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {unpricedPending > 0 && (
                <button
                  onClick={() => handleEstimatePrices(false)}
                  disabled={estimating}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  {estimating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {estimating ? "Estimando…" : `Estimar precios (${unpricedPending})`}
                </button>
              )}
              {unpricedPending === 0 && items.length > 0 && (
                <button
                  onClick={() => handleEstimatePrices(true)}
                  disabled={estimating}
                  title="Re-estimar todos los precios con IA"
                  className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {estimating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Re-estimar
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick add */}
      {list.status === "active" && (
        <QuickAddForm listId={list.id} onAdded={handleAdded} />
      )}

      {/* Items */}
      {loading ? (
        <div className="text-center py-10 text-slate-400 text-sm">Cargando…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingCart className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Lista vacía — agrega tu primer producto</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pending items grouped by category */}
          {grouped.map(({ cat, items: catItems }) => {
            const cfg = CATEGORY_CONFIG[cat];
            return (
              <div key={cat} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-50 bg-slate-50/70">
                  <span className="text-base">{cfg.emoji}</span>
                  <span className={cn("text-xs font-semibold uppercase tracking-wide", cfg.color)}>
                    {cfg.label}
                  </span>
                  <span className="text-xs text-slate-400 ml-auto">{catItems.length}</span>
                </div>
                <div className="px-3 py-1 divide-y divide-slate-50">
                  {catItems.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                      onEdit={setEditingItem}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Done items (collapsed) */}
          {done.length > 0 && (
            <DoneSection
              items={done}
              listId={list.id}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onEdit={setEditingItem}
            />
          )}
        </div>
      )}

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={handleItemSaved}
        />
      )}

      {editingList && (
        <EditListModal
          list={list}
          businesses={businesses}
          onClose={() => setEditingList(false)}
          onSaved={(patch) => {
            onListUpdate({ ...list, ...patch });
            setEditingList(false);
          }}
        />
      )}
    </div>
  );
}

// ── Done Section (collapsible) ────────────────────────────────────────────────

function DoneSection({
  items,
  listId,
  onToggle,
  onDelete,
  onEdit,
}: {
  items: ShoppingItemRow[];
  listId: string;
  onToggle: (id: string, isDone: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (item: ShoppingItemRow) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b border-slate-50 bg-slate-50/70 hover:bg-slate-100 transition-colors"
      >
        <Check className="w-4 h-4 text-emerald-500" />
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Completados
        </span>
        <span className="text-xs text-slate-400 ml-auto">{items.length}</span>
        <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-3 py-1 divide-y divide-slate-50">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onToggle={onToggle}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ShoppingList({
  initialLists,
  businesses,
  weekStart,
  weekEntries,
}: {
  initialLists: ShoppingListRow[];
  businesses: BusinessOption[];
  weekStart?: string;
  weekEntries?: MealEntryRef[];
}) {
  const [lists, setLists] = useState<ShoppingListRow[]>(initialLists);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialLists.find((l) => l.status === "active")?.id ?? initialLists[0]?.id ?? null
  );
  const [showNewList, setShowNewList] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"active" | "all">("active");

  const hasWeekMeals = weekStart && weekEntries && weekEntries.length > 0;

  const activeList = lists.find((l) => l.id === selectedId) ?? null;

  const visibleLists = lists.filter((l) =>
    filterStatus === "all" ? true : l.status === "active" || l.status === "done"
  );

  function handleListCreated(list: ShoppingListRow) {
    setLists((prev) => [list, ...prev]);
    setSelectedId(list.id);
  }

  function handleListUpdate(updated: ShoppingListRow) {
    setLists((prev) => prev.map((l) => l.id === updated.id ? updated : l));
  }

  function handleListCloned(cloned: ShoppingListRow) {
    setLists((prev) => [cloned, ...prev]);
    setSelectedId(cloned.id);
  }

  async function handleDeleteList(id: string) {
    if (!confirm("¿Eliminar esta lista y todos sus productos?")) return;
    await fetch(`/api/shopping-lists/${id}`, { method: "DELETE" });
    setLists((prev) => prev.filter((l) => l.id !== id));
    if (selectedId === id) {
      const next = lists.find((l) => l.id !== id);
      setSelectedId(next?.id ?? null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Lista de compras</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {lists.filter((l) => l.status === "active").length} lista{lists.filter((l) => l.status === "active").length !== 1 ? "s" : ""} activa{lists.filter((l) => l.status === "active").length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasWeekMeals && (
            <button
              onClick={() => setShowGenerate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Generar con IA
            </button>
          )}
          <button
            onClick={() => setShowNewList(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva lista
          </button>
        </div>
      </div>

      {/* List selector chips */}
      {lists.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 items-center">
          {visibleLists.map((list) => {
            const pct = list.itemCount > 0 ? Math.round((list.doneCount / list.itemCount) * 100) : 0;
            return (
              <button
                key={list.id}
                onClick={() => setSelectedId(list.id)}
                className={cn(
                  "flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm transition-all",
                  selectedId === list.id
                    ? "bg-[#1e3a5f] text-white border-[#1e3a5f] shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                )}
              >
                <span className="font-medium truncate max-w-[140px]">{list.name}</span>
                {list.itemCount > 0 && (
                  <span className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full font-medium",
                    selectedId === list.id
                      ? "bg-white/20 text-white"
                      : pct === 100
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  )}>
                    {pct === 100 ? "✓" : `${list.doneCount}/${list.itemCount}`}
                  </span>
                )}
              </button>
            );
          })}
          <button
            onClick={() => setFilterStatus((s) => s === "active" ? "all" : "active")}
            className="flex-shrink-0 px-3 py-2 text-xs text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {filterStatus === "active" ? "Ver archivadas" : "Ocultar archivadas"}
          </button>
        </div>
      )}

      {/* Empty state */}
      {lists.length === 0 && (
        <div className="text-center py-20">
          <ShoppingCart className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">No tienes listas de compras</p>
          <p className="text-sm text-slate-400 mt-1">Crea tu primera lista para empezar</p>
          <button
            onClick={() => setShowNewList(true)}
            className="mt-4 px-4 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] transition-colors"
          >
            Crear primera lista
          </button>
        </div>
      )}

      {/* Active list content */}
      {activeList && (
        <ActiveListView
          key={activeList.id}
          list={activeList}
          businesses={businesses}
          onListUpdate={handleListUpdate}
          onListCloned={handleListCloned}
        />
      )}

      {/* Delete list link */}
      {activeList && (
        <div className="flex justify-end">
          <button
            onClick={() => handleDeleteList(activeList.id)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar lista
          </button>
        </div>
      )}

      {showNewList && (
        <NewListModal
          businesses={businesses}
          onClose={() => setShowNewList(false)}
          onCreate={handleListCreated}
        />
      )}

      {showGenerate && weekStart && weekEntries && (
        <GenerateModal
          businesses={businesses}
          weekStart={weekStart}
          weekEntries={weekEntries}
          onClose={() => setShowGenerate(false)}
          onGenerated={(list) => {
            handleListCreated(list);
            setShowGenerate(false);
          }}
        />
      )}
    </div>
  );
}
