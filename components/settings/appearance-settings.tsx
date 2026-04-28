"use client";

import { useState, useCallback } from "react";
import { useSkin } from "@/components/providers/skin-provider";
import {
  Skin, SkinVars, SKIN_GROUPS, BUILTIN_SKINS,
  deriveSkinVars, DARK_BASE, LIGHT_BASE,
} from "@/lib/skins";
import { Plus, X, Check, ChevronDown, ChevronUp, RotateCcw, Moon, Sun, Wand2, Pencil, Trash2 } from "lucide-react";
import { isColorDark } from "@/lib/skins";
import { cn } from "@/lib/utils";

// ─── Mini thumbnail preview (for skin cards) ──────────────────────────────────

function SkinMiniPreview({ preview }: { preview: Skin["preview"] }) {
  return (
    <div
      className="w-16 h-10 rounded overflow-hidden flex-shrink-0 border border-black/10"
      style={{ background: preview.bg }}
    >
      <div className="h-[30%] flex items-center px-1 gap-0.5" style={{ background: preview.surface }}>
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: preview.accent }} />
        <div className="w-1.5 h-1.5 rounded-full opacity-30" style={{ background: preview.text }} />
      </div>
      <div className="flex h-[70%]">
        <div className="w-[28%] h-full" style={{ background: preview.surface }}>
          <div className="mt-1 mx-0.5 space-y-0.5">
            <div className="h-0.5 rounded-full opacity-70" style={{ background: preview.accent }} />
            <div className="h-0.5 rounded-full opacity-25" style={{ background: preview.text }} />
            <div className="h-0.5 rounded-full opacity-25" style={{ background: preview.text }} />
          </div>
        </div>
        <div className="flex-1 h-full p-0.5 space-y-0.5">
          <div className="h-1 rounded-full opacity-20" style={{ background: preview.text }} />
          <div className="h-1 rounded-full w-2/3 opacity-20" style={{ background: preview.text }} />
        </div>
      </div>
    </div>
  );
}

// ─── Full detail preview (for the creator) ────────────────────────────────────

function SkinDetailPreview({ vars }: { vars: SkinVars }) {
  return (
    <div
      className="rounded-xl overflow-hidden border border-black/10 w-full flex-shrink-0 shadow-sm"
      style={{ background: vars.pageBackground }}
    >
      {/* Header */}
      <div
        className="h-8 flex items-center px-2.5 gap-2 border-b"
        style={{ background: vars.headerBackground, borderColor: vars.headerBorder }}
      >
        <div className="w-14 h-2 rounded-full" style={{ background: vars.activeText, opacity: 0.85 }} />
        <div className="flex-1" />
        <div className="w-5 h-5 rounded-full" style={{ background: vars.headerText, opacity: 0.2 }} />
        <div className="w-5 h-5 rounded-full" style={{ background: vars.headerText, opacity: 0.2 }} />
      </div>

      <div className="flex" style={{ minHeight: 140 }}>
        {/* Sidebar */}
        <div
          className="w-16 flex flex-col py-2 px-1.5 gap-1 border-r flex-shrink-0"
          style={{ background: vars.sidebarBackground, borderColor: vars.sidebarBorder }}
        >
          <div className="h-3.5 rounded px-1 flex items-center gap-1" style={{ background: vars.activeBg }}>
            <div className="w-1 h-1 rounded-full" style={{ background: vars.activeText }} />
            <div className="h-1 rounded-full flex-1" style={{ background: vars.activeText, opacity: 0.8 }} />
          </div>
          {[0.2, 0.15, 0.15, 0.12].map((op, i) => (
            <div key={i} className="h-3 rounded px-1 flex items-center gap-1" style={{ background: vars.sidebarHover, opacity: op * 3 }}>
              <div className="w-1 h-1 rounded-full" style={{ background: vars.sidebarText, opacity: op * 5 }} />
              <div className="h-0.5 rounded-full flex-1" style={{ background: vars.sidebarText, opacity: op * 5 }} />
            </div>
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 p-2.5 space-y-2" style={{ background: vars.contentBackground }}>
          {/* Card */}
          <div className="rounded-lg border p-2" style={{ background: vars.cardBackground, borderColor: vars.cardBorder }}>
            <div className="h-2 rounded-full w-3/4 mb-1.5" style={{ background: vars.cardText, opacity: 0.7 }} />
            <div className="h-1.5 rounded-full w-1/2 mb-1" style={{ background: vars.cardTextMuted, opacity: 0.5 }} />
            <div className="h-1 rounded-full w-2/3" style={{ background: vars.cardTextMuted, opacity: 0.3 }} />
          </div>

          {/* Table */}
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: vars.tableBorder }}>
            <div
              className="h-4 px-2 flex items-center gap-3"
              style={{ background: vars.tableHeaderBg }}
            >
              <div className="h-1 rounded-full w-1/4" style={{ background: vars.tableHeaderText, opacity: 0.7 }} />
              <div className="h-1 rounded-full w-1/5" style={{ background: vars.tableHeaderText, opacity: 0.7 }} />
              <div className="h-1 rounded-full w-1/6" style={{ background: vars.tableHeaderText, opacity: 0.7 }} />
            </div>
            {[1, 0.6].map((op, i) => (
              <div
                key={i}
                className="h-4 px-2 flex items-center gap-3 border-t"
                style={{ background: vars.cardBackground, borderColor: vars.dividerColor }}
              >
                <div className="h-1 rounded-full w-1/3" style={{ background: vars.textPrimary, opacity: op * 0.6 }} />
                <div className="h-1 rounded-full w-1/5" style={{ background: vars.textMuted, opacity: op * 0.4 }} />
                <div className="h-1 rounded-full w-1/6" style={{ background: vars.textMuted, opacity: op * 0.35 }} />
              </div>
            ))}
          </div>

          {/* Input + button row */}
          <div className="flex gap-2">
            <div
              className="flex-1 h-5 rounded border px-1.5 flex items-center"
              style={{ background: vars.inputBackground, borderColor: vars.inputBorder }}
            >
              <div className="h-1 rounded-full w-2/3" style={{ background: vars.inputText, opacity: 0.25 }} />
            </div>
            <div
              className="h-5 px-2 rounded flex items-center justify-center"
              style={{ background: vars.buttonBg }}
            >
              <div className="h-1 w-6 rounded-full" style={{ background: vars.buttonText, opacity: 0.9 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Skin selection card ──────────────────────────────────────────────────────

function SkinCard({
  skin, active, onSelect, onEdit, onDelete,
}: {
  skin: Skin; active: boolean; onSelect: () => void; onEdit?: () => void; onDelete?: () => void;
}) {
  const isCustom = skin.type === "custom";

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border-2 overflow-hidden transition-all",
        active
          ? "border-[var(--skin-active-text,#1e3a5f)] bg-[var(--skin-active-bg,#eef5ff)]"
          : "border-[var(--skin-border,#e2e8f0)] hover:border-[var(--skin-active-text,#1e3a5f)]/40 bg-white dark:bg-slate-800"
      )}
    >
      {/* Clickable area */}
      <div
        onClick={onSelect}
        className="flex flex-col gap-2 p-3 cursor-pointer flex-1 relative"
      >
        {active && (
          <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--skin-active-text,#1e3a5f)] flex items-center justify-center">
            <Check className="w-3 h-3 text-white" />
          </span>
        )}
        <SkinMiniPreview preview={skin.preview} />
        <div className="pr-5">
          <p className="text-xs font-semibold text-[var(--skin-header-text,#0f172a)] truncate">{skin.name}</p>
          <p className="text-[10px] text-[var(--skin-header-text-muted,#64748b)] leading-tight mt-0.5 line-clamp-2">{skin.description}</p>
        </div>
      </div>

      {/* Action row — always visible for custom skins, works on mobile */}
      {isCustom && (onEdit || onDelete) && (
        <div className="flex border-t border-[var(--skin-border,#e2e8f0)]">
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium text-[var(--skin-header-text-muted,#64748b)] hover:text-[var(--skin-active-text,#1e3a5f)] hover:bg-[var(--skin-active-bg,#eef5ff)] transition-colors"
            >
              <Pencil className="w-2.5 h-2.5" />
              Editar
            </button>
          )}
          {onEdit && onDelete && (
            <div className="w-px bg-[var(--skin-border,#e2e8f0)]" />
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium text-[var(--skin-header-text-muted,#64748b)] hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-2.5 h-2.5" />
              Borrar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function NewSkinCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-[var(--skin-border,#e2e8f0)] hover:border-[var(--skin-active-text,#1e3a5f)]/50 text-[var(--skin-header-text-muted,#64748b)] hover:text-[var(--skin-active-text,#1e3a5f)] transition-all min-h-[110px]"
    >
      <Plus className="w-5 h-5" />
      <span className="text-xs font-medium">Nuevo skin</span>
    </button>
  );
}

// ─── Color picker field ───────────────────────────────────────────────────────

function ColorField({
  label, hint, value, onChange,
}: {
  label: string; hint?: string; value: string; onChange: (v: string) => void;
}) {
  const safeValue = value.startsWith("#") && value.length >= 7 ? value.slice(0, 7) : "#000000";

  return (
    <div className="flex items-start gap-3 py-1.5">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--skin-header-text,#0f172a)]">{label}</p>
        {hint && <p className="text-[10px] text-[var(--skin-header-text-muted,#64748b)] mt-0.5 leading-tight">{hint}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="relative">
          <input
            type="color"
            value={safeValue}
            onChange={(e) => onChange(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border-2 border-[var(--skin-border,#e2e8f0)] p-0.5 bg-transparent"
          />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-20 text-xs px-2 py-1.5 rounded-lg border border-[var(--skin-border,#e2e8f0)] bg-transparent text-[var(--skin-header-text,#0f172a)] font-mono text-center"
          maxLength={9}
          spellCheck={false}
        />
      </div>
    </div>
  );
}

// ─── Group accordion ──────────────────────────────────────────────────────────

function SkinGroupPanel({
  group, vars, expanded, onToggle, onChangeVar, onReset,
}: {
  group: typeof SKIN_GROUPS[0];
  vars: SkinVars;
  expanded: boolean;
  onToggle: () => void;
  onChangeVar: (key: keyof SkinVars, value: string) => void;
  onReset: () => void;
}) {
  const swatches = group.fields.slice(0, 4).map((f) => vars[f.key]);

  return (
    <div className="rounded-xl border border-[var(--skin-border,#e2e8f0)] overflow-hidden bg-white dark:bg-slate-800">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/60 dark:hover:bg-slate-700/40 transition-colors"
      >
        <span className="text-base">{group.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--skin-header-text,#0f172a)]">{group.label}</p>
          <p className="text-[11px] text-[var(--skin-header-text-muted,#64748b)] mt-0.5">{group.description}</p>
        </div>
        {/* Color swatches preview */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {swatches.map((color, i) => (
            <div
              key={i}
              className="w-4 h-4 rounded-full border border-black/10 flex-shrink-0"
              style={{ background: color }}
            />
          ))}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--skin-header-text-muted,#64748b)] flex-shrink-0 ml-1" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--skin-header-text-muted,#64748b)] flex-shrink-0 ml-1" />
        )}
      </button>

      {/* Fields */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-[var(--skin-border,#e2e8f0)]">
          <div className="divide-y divide-[var(--skin-divider,#f1f5f9)]">
            {group.fields.map((field) => (
              <ColorField
                key={field.key}
                label={field.label}
                hint={field.hint}
                value={vars[field.key]}
                onChange={(v) => onChangeVar(field.key, v)}
              />
            ))}
          </div>
          <button
            onClick={onReset}
            className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--skin-header-text-muted,#64748b)] hover:text-[var(--skin-active-text,#1e3a5f)] transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Restaurar este grupo a valores automáticos
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Mode = "dark" | "light";

const BASE_PRESETS: Record<Mode, { bg: string; surface: string; text: string }> = {
  dark:  { bg: DARK_BASE.bg,  surface: DARK_BASE.surface,  text: DARK_BASE.text  },
  light: { bg: LIGHT_BASE.bg, surface: LIGHT_BASE.surface, text: LIGHT_BASE.text },
};

export function AppearanceSettings() {
  const { activeSkinId, allSkins, setSkin, addCustomSkin, removeCustomSkin } = useSkin();

  const [showCreator, setShowCreator] = useState(false);
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [newName, setNewName]         = useState("");
  const [mode, setMode]               = useState<Mode>("dark");
  const [accent, setAccent]           = useState("#58a6ff");
  const [vars, setVars]               = useState<SkinVars>(() =>
    deriveSkinVars(DARK_BASE.bg, DARK_BASE.surface, DARK_BASE.accent, DARK_BASE.text)
  );
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Re-derive all vars when mode changes
  const handleModeChange = useCallback((newMode: Mode) => {
    setMode(newMode);
    const base = BASE_PRESETS[newMode];
    setVars(deriveSkinVars(base.bg, base.surface, accent, base.text));
  }, [accent]);

  // Re-derive all vars when accent changes
  const handleAccentChange = useCallback((newAccent: string) => {
    setAccent(newAccent);
    const base = BASE_PRESETS[mode];
    setVars(deriveSkinVars(base.bg, base.surface, newAccent, base.text));
  }, [mode]);

  // Change one specific var
  const setVar = useCallback((key: keyof SkinVars, value: string) => {
    setVars((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Reset a group to auto-derived values
  const resetGroup = useCallback((groupId: string) => {
    const base = BASE_PRESETS[mode];
    const derived = deriveSkinVars(base.bg, base.surface, accent, base.text);
    const group = SKIN_GROUPS.find((g) => g.id === groupId);
    if (!group) return;
    setVars((prev) => {
      const next = { ...prev };
      for (const field of group.fields) {
        (next as unknown as Record<string, string>)[field.key] = (derived as unknown as Record<string, string>)[field.key];
      }
      return next;
    });
  }, [mode, accent]);

  function openCreator() {
    setNewName("");
    setEditingId(null);
    setMode("dark");
    setAccent(DARK_BASE.accent);
    setVars(deriveSkinVars(DARK_BASE.bg, DARK_BASE.surface, DARK_BASE.accent, DARK_BASE.text));
    setExpandedGroup(null);
    setShowCreator(true);
  }

  function openEditor(skin: Skin) {
    setNewName(skin.name);
    setEditingId(skin.id);
    if (skin.vars) {
      const detectedMode: Mode = isColorDark(skin.vars.pageBackground) ? "dark" : "light";
      setMode(detectedMode);
      setAccent(skin.vars.activeText);
      setVars(skin.vars);
    } else {
      setMode("dark");
      setAccent(DARK_BASE.accent);
      setVars(deriveSkinVars(DARK_BASE.bg, DARK_BASE.surface, DARK_BASE.accent, DARK_BASE.text));
    }
    setExpandedGroup(null);
    setShowCreator(true);
  }

  function handleSave() {
    if (!newName.trim()) return;
    const id = editingId ?? `custom-${Date.now()}`;
    const skin: Skin = {
      id,
      name: newName.trim(),
      description: `Skin personalizado — ${mode === "dark" ? "oscuro" : "claro"}`,
      type: "custom",
      preview: { bg: vars.pageBackground, surface: vars.cardBackground, accent: vars.activeText, text: vars.textPrimary },
      vars,
    };
    addCustomSkin(skin);
    setSkin(id);
    setShowCreator(false);
    setEditingId(null);
  }

  // Skins split: built-ins first, then custom
  const builtins = allSkins.filter((s) => s.type === "builtin");
  const customs  = allSkins.filter((s) => s.type === "custom");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-[var(--skin-header-text,#0f172a)] mb-1">Apariencia</h2>
        <p className="text-xs text-[var(--skin-header-text-muted,#64748b)]">
          Elige un skin existente o crea uno completamente personalizado.
        </p>
      </div>

      {/* Built-in skins */}
      <div>
        <p className="text-[11px] font-semibold text-[var(--skin-header-text-muted,#64748b)] uppercase tracking-wide mb-2">
          Incluidos
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {builtins.map((skin) => (
            <SkinCard
              key={skin.id}
              skin={skin}
              active={activeSkinId === skin.id}
              onSelect={() => setSkin(skin.id)}
            />
          ))}
        </div>
      </div>

      {/* Custom skins */}
      {customs.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[var(--skin-header-text-muted,#64748b)] uppercase tracking-wide mb-2">
            Mis skins
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {customs.map((skin) => (
              <SkinCard
                key={skin.id}
                skin={skin}
                active={activeSkinId === skin.id}
                onSelect={() => setSkin(skin.id)}
                onEdit={() => openEditor(skin)}
                onDelete={() => removeCustomSkin(skin.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* New skin button */}
      {!showCreator && (
        <button
          onClick={openCreator}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-[var(--skin-border,#e2e8f0)] hover:border-[var(--skin-active-text,#1e3a5f)]/50 text-[var(--skin-header-text-muted,#64748b)] hover:text-[var(--skin-active-text,#1e3a5f)] text-sm font-medium transition-all"
        >
          <Plus className="w-4 h-4" />
          Crear nuevo skin
        </button>
      )}

      {/* ─── Creator panel ─────────────────────────────────────────────── */}
      {showCreator && (
        <div className="rounded-2xl border border-[var(--skin-border,#e2e8f0)] bg-[var(--skin-card-bg,#fff)] overflow-hidden">
          {/* Creator header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--skin-border,#e2e8f0)] bg-[var(--skin-content-bg,#f8fafc)]">
            <Wand2 className="w-4 h-4 text-[var(--skin-active-text,#1e3a5f)]" />
            <h3 className="text-sm font-semibold text-[var(--skin-header-text,#0f172a)] flex-1">
              {editingId ? "Editar skin" : "Crear skin personalizado"}
            </h3>
            <button
              onClick={() => setShowCreator(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-4 h-4 text-[var(--skin-header-text-muted,#64748b)]" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {/* Row: Name + mode + accent */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Name */}
              <div className="sm:col-span-1">
                <label className="text-xs font-medium text-[var(--skin-header-text,#0f172a)] mb-1.5 block">
                  Nombre del skin
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Mi skin oscuro…"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--skin-border,#e2e8f0)] bg-transparent text-[var(--skin-header-text,#0f172a)] placeholder:text-[var(--skin-header-text-muted,#94a3b8)]"
                />
              </div>

              {/* Mode toggle */}
              <div>
                <p className="text-xs font-medium text-[var(--skin-header-text,#0f172a)] mb-1.5">Modo base</p>
                <div className="flex rounded-lg border border-[var(--skin-border,#e2e8f0)] overflow-hidden h-9">
                  <button
                    onClick={() => handleModeChange("dark")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors",
                      mode === "dark"
                        ? "bg-slate-800 text-white"
                        : "bg-transparent text-[var(--skin-header-text-muted,#64748b)] hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    <Moon className="w-3.5 h-3.5" /> Oscuro
                  </button>
                  <button
                    onClick={() => handleModeChange("light")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors border-l border-[var(--skin-border,#e2e8f0)]",
                      mode === "light"
                        ? "bg-white text-slate-800 shadow-sm"
                        : "bg-transparent text-[var(--skin-header-text-muted,#64748b)] hover:bg-slate-100 dark:hover:bg-slate-700"
                    )}
                  >
                    <Sun className="w-3.5 h-3.5" /> Claro
                  </button>
                </div>
              </div>

              {/* Accent color */}
              <div>
                <p className="text-xs font-medium text-[var(--skin-header-text,#0f172a)] mb-1.5">
                  Color de acento
                  <span className="text-[10px] font-normal text-[var(--skin-header-text-muted,#64748b)] ml-1.5">— regenera todo</span>
                </p>
                <div className="flex items-center gap-2 h-9">
                  <input
                    type="color"
                    value={accent.slice(0, 7)}
                    onChange={(e) => handleAccentChange(e.target.value)}
                    className="w-9 h-9 rounded-lg border-2 border-[var(--skin-border,#e2e8f0)] cursor-pointer p-0.5 bg-transparent flex-shrink-0"
                  />
                  <input
                    type="text"
                    value={accent}
                    onChange={(e) => handleAccentChange(e.target.value)}
                    className="flex-1 text-xs px-3 h-9 rounded-lg border border-[var(--skin-border,#e2e8f0)] bg-transparent text-[var(--skin-header-text,#0f172a)] font-mono"
                    maxLength={7}
                    spellCheck={false}
                  />
                </div>
              </div>
            </div>

            {/* Preview + groups side by side on large screens */}
            <div className="flex flex-col lg:flex-row gap-5">
              {/* Preview (sticky on large) */}
              <div className="lg:w-56 lg:flex-shrink-0">
                <p className="text-xs font-medium text-[var(--skin-header-text-muted,#64748b)] mb-2">Vista previa</p>
                <SkinDetailPreview vars={vars} />
                <p className="text-[10px] text-[var(--skin-header-text-muted,#64748b)] mt-2 text-center">
                  Se actualiza en tiempo real
                </p>
              </div>

              {/* Group accordions */}
              <div className="flex-1 space-y-2">
                <p className="text-xs font-medium text-[var(--skin-header-text-muted,#64748b)]">
                  Personalizar por grupo — expande para ajustar colores individuales
                </p>
                {SKIN_GROUPS.map((group) => (
                  <SkinGroupPanel
                    key={group.id}
                    group={group}
                    vars={vars}
                    expanded={expandedGroup === group.id}
                    onToggle={() => setExpandedGroup((v) => v === group.id ? null : group.id)}
                    onChangeVar={setVar}
                    onReset={() => resetGroup(group.id)}
                  />
                ))}
              </div>
            </div>

            {/* Action row */}
            <div className="flex items-center gap-3 pt-2 border-t border-[var(--skin-border,#e2e8f0)]">
              <button
                onClick={handleSave}
                disabled={!newName.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-[var(--skin-btn-bg,#1e3a5f)] text-[var(--skin-btn-text,#fff)] hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {editingId ? "Guardar cambios" : "Crear skin"}
              </button>
              <button
                onClick={() => setShowCreator(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-[var(--skin-header-text-muted,#64748b)] hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <p className="ml-auto text-[11px] text-[var(--skin-header-text-muted,#64748b)] hidden sm:block">
                Cambiar modo o acento regenera todos los colores automáticamente
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
