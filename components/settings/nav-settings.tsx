"use client";

import { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, GripVertical, Monitor, Smartphone, RotateCcw } from "lucide-react";
import { NAV_GROUPS, ALL_NAV_ITEMS, NavItem } from "@/lib/nav-groups";
import { NavPrefs, DEFAULT_PREFS, loadNavPrefs, saveNavPrefs, applyOrder } from "@/lib/nav-prefs";
import { cn } from "@/lib/utils";

type Tab = "desktop" | "mobile";

// ── Drag-and-drop state ────────────────────────────────────────────────────────

type DragState = { href: string; groupId: string } | null;

// ── Item row ──────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  isHidden,
  isDragging,
  isDragOver,
  draggable,
  onToggle,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  item: NavItem;
  isHidden: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  draggable: boolean;
  onToggle: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all select-none",
        isDragging
          ? "opacity-30 border-dashed border-slate-300 bg-slate-50"
          : isDragOver
          ? "border-blue-400 bg-blue-50 shadow-sm"
          : "border-slate-100 bg-slate-50 hover:border-slate-200",
        isHidden && !isDragging && "opacity-50"
      )}
    >
      {draggable && (
        <GripVertical className="w-4 h-4 text-slate-300 cursor-grab active:cursor-grabbing shrink-0" />
      )}
      <item.icon className={cn("w-4 h-4 shrink-0", isHidden ? "text-slate-300" : "text-slate-500")} />
      <span className={cn("text-sm flex-1", isHidden ? "text-slate-400 line-through" : "text-slate-700")}>
        {item.label}
      </span>
      <button
        onClick={onToggle}
        title={isHidden ? "Mostrar" : "Ocultar"}
        className={cn(
          "p-1.5 rounded-lg transition-colors",
          isHidden
            ? "text-slate-300 hover:text-emerald-500"
            : "text-slate-400 hover:text-slate-700"
        )}
      >
        {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function NavSettings() {
  const [tab, setTab] = useState<Tab>("desktop");
  const [prefs, setPrefs] = useState<NavPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [drag, setDrag] = useState<DragState>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const dragRef = useRef<DragState>(null);

  useEffect(() => {
    setPrefs(loadNavPrefs());
    setLoaded(true);
  }, []);

  function update(newPrefs: NavPrefs) {
    setPrefs(newPrefs);
    saveNavPrefs(newPrefs);
    // Notify sidebar/mobile-nav to refresh from localStorage
    window.dispatchEvent(new CustomEvent("nav-prefs-changed"));
  }

  function toggleDesktop(href: string) {
    const hidden = prefs.hiddenDesktop.includes(href)
      ? prefs.hiddenDesktop.filter((h) => h !== href)
      : [...prefs.hiddenDesktop, href];
    update({ ...prefs, hiddenDesktop: hidden });
  }

  function toggleMobile(href: string) {
    const hidden = prefs.hiddenMobile.includes(href)
      ? prefs.hiddenMobile.filter((h) => h !== href)
      : [...prefs.hiddenMobile, href];
    update({ ...prefs, hiddenMobile: hidden });
  }

  function getOrderedItems(groupId: string, items: NavItem[]): NavItem[] {
    const custom = prefs.groupItemOrder[groupId] ?? [];
    const hrefs = applyOrder(items.map((i) => i.href), custom);
    const map = new Map(items.map((i) => [i.href, i]));
    return hrefs.map((h) => map.get(h)!).filter(Boolean);
  }

  // ── Drag handlers ────────────────────────────────────────────────────────────

  function handleDragStart(href: string, groupId: string) {
    const state = { href, groupId };
    setDrag(state);
    dragRef.current = state;
  }

  function handleDragOver(e: React.DragEvent, href: string) {
    e.preventDefault();
    setDragOver(href);
  }

  function handleDrop(groupId: string, targetHref: string) {
    const from = dragRef.current;
    if (!from || from.groupId !== groupId || from.href === targetHref) {
      endDrag();
      return;
    }

    const group = NAV_GROUPS.find((g) => g.id === groupId)!;
    const ordered = getOrderedItems(groupId, group.items).map((i) => i.href);
    const fromIdx = ordered.indexOf(from.href);
    const toIdx = ordered.indexOf(targetHref);

    const next = [...ordered];
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, from.href);

    update({ ...prefs, groupItemOrder: { ...prefs.groupItemOrder, [groupId]: next } });
    endDrag();
  }

  function endDrag() {
    setDrag(null);
    setDragOver(null);
    dragRef.current = null;
  }

  function reset() {
    update(DEFAULT_PREFS);
  }

  const collapsableGroups = NAV_GROUPS.filter((g) => g.collapsable);
  const fixedGroups = NAV_GROUPS.filter((g) => !g.collapsable);

  const desktopHidden = prefs.hiddenDesktop.length;
  const mobileHidden = prefs.hiddenMobile.length;

  if (!loaded) {
    return <div className="h-48 animate-pulse bg-slate-50 rounded-2xl border border-slate-200" />;
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Navegación</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Ordena y muestra u oculta ítems del menú
          </p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Restablecer
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100">
        <button
          onClick={() => setTab("desktop")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors",
            tab === "desktop"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Monitor className="w-4 h-4" />
          Desktop
          {desktopHidden > 0 && (
            <span className="text-[10px] bg-slate-200 text-slate-500 rounded-full px-1.5 py-0.5 font-medium">
              {desktopHidden} ocultos
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("mobile")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors",
            tab === "mobile"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
              : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Smartphone className="w-4 h-4" />
          Mobile
          {mobileHidden > 0 && (
            <span className="text-[10px] bg-slate-200 text-slate-500 rounded-full px-1.5 py-0.5 font-medium">
              {mobileHidden} ocultos
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="p-5 space-y-5">
        {tab === "desktop" ? (
          <>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <GripVertical className="w-3.5 h-3.5" />
              Arrastra para reordenar dentro de cada grupo. Toca el ojo para ocultar.
            </p>

            {/* Collapsable groups with drag-and-drop */}
            {collapsableGroups.map((group) => {
              const items = getOrderedItems(group.id, group.items);
              return (
                <div key={group.id}>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">
                    {group.label}
                  </p>
                  <div className="space-y-1.5">
                    {items.map((item) => (
                      <ItemRow
                        key={item.href}
                        item={item}
                        isHidden={prefs.hiddenDesktop.includes(item.href)}
                        isDragging={drag?.href === item.href}
                        isDragOver={dragOver === item.href && drag?.groupId === group.id}
                        draggable
                        onToggle={() => toggleDesktop(item.href)}
                        onDragStart={() => handleDragStart(item.href, group.id)}
                        onDragOver={(e) => handleDragOver(e, item.href)}
                        onDrop={() => handleDrop(group.id, item.href)}
                        onDragEnd={endDrag}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Fixed items (Dashboard, Chat, Usuarios) — toggle only */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">
                Fijos
              </p>
              <div className="space-y-1.5">
                {fixedGroups.flatMap((g) => g.items).map((item) => (
                  <ItemRow
                    key={item.href}
                    item={item}
                    isHidden={prefs.hiddenDesktop.includes(item.href)}
                    isDragging={false}
                    isDragOver={false}
                    draggable={false}
                    onToggle={() => toggleDesktop(item.href)}
                    onDragStart={() => {}}
                    onDragOver={() => {}}
                    onDrop={() => {}}
                    onDragEnd={() => {}}
                  />
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-400">
              Selecciona qué ítems aparecen en la barra inferior de mobile.
            </p>

            {/* All items flat, grouped visually */}
            {NAV_GROUPS.map((group) => {
              const items = group.collapsable
                ? getOrderedItems(group.id, group.items)
                : group.items;
              return (
                <div key={group.id}>
                  {group.label && (
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">
                      {group.label}
                    </p>
                  )}
                  <div className="space-y-1.5">
                    {items.map((item) => (
                      <ItemRow
                        key={item.href}
                        item={item}
                        isHidden={prefs.hiddenMobile.includes(item.href)}
                        isDragging={false}
                        isDragOver={false}
                        draggable={false}
                        onToggle={() => toggleMobile(item.href)}
                        onDragStart={() => {}}
                        onDragOver={() => {}}
                        onDrop={() => {}}
                        onDragEnd={() => {}}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
}
