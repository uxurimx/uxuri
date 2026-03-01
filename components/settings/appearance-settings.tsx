"use client";

import { useState } from "react";
import { useSkin } from "@/components/providers/skin-provider";
import { Skin, deriveSkinVars } from "@/lib/skins";
import { Plus, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

function SkinMiniPreview({ preview }: { preview: Skin["preview"] }) {
  return (
    <div
      className="w-16 h-10 rounded overflow-hidden flex-shrink-0 border border-black/10"
      style={{ background: preview.bg }}
    >
      {/* Top header bar */}
      <div className="h-[30%] flex" style={{ background: preview.surface }}>
        <div className="w-full flex items-center px-1 gap-0.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: preview.accent }} />
          <div className="w-1.5 h-1.5 rounded-full opacity-40" style={{ background: preview.text }} />
        </div>
      </div>
      {/* Content area */}
      <div className="flex h-[70%]">
        {/* Sidebar strip */}
        <div className="w-[28%] h-full" style={{ background: preview.surface }}>
          <div className="mt-1 mx-0.5 space-y-0.5">
            <div className="h-0.5 rounded-full opacity-60" style={{ background: preview.accent }} />
            <div className="h-0.5 rounded-full opacity-30" style={{ background: preview.text }} />
            <div className="h-0.5 rounded-full opacity-30" style={{ background: preview.text }} />
          </div>
        </div>
        {/* Page bg */}
        <div className="flex-1 h-full p-0.5 space-y-0.5">
          <div className="h-1 rounded-full opacity-20" style={{ background: preview.text }} />
          <div className="h-1 rounded-full w-2/3 opacity-20" style={{ background: preview.text }} />
        </div>
      </div>
    </div>
  );
}

function SkinCard({
  skin,
  active,
  onSelect,
  onDelete,
}: {
  skin: Skin;
  active: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "relative flex flex-col gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all",
        active
          ? "border-[var(--skin-active-text,#1e3a5f)] bg-[var(--skin-active-bg,#eef5ff)]"
          : "border-[var(--skin-border,#e2e8f0)] hover:border-[var(--skin-active-text,#1e3a5f)]/40 bg-white dark:bg-slate-800"
      )}
    >
      {active && (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--skin-active-text,#1e3a5f)] flex items-center justify-center">
          <Check className="w-3 h-3 text-white" />
        </span>
      )}
      {onDelete && !active && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900 flex items-center justify-center transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      <SkinMiniPreview preview={skin.preview} />
      <div>
        <p className="text-xs font-semibold text-[var(--skin-header-text,#0f172a)]">{skin.name}</p>
        <p className="text-[10px] text-[var(--skin-header-text-muted,#64748b)] leading-tight mt-0.5">{skin.description}</p>
      </div>
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
      <span className="text-xs font-medium">Nuevo Skin</span>
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <label className="text-xs text-[var(--skin-header-text-muted,#64748b)] w-24 flex-shrink-0">{label}</label>
      <div className="flex items-center gap-2 flex-1">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-[var(--skin-border,#e2e8f0)] flex-shrink-0"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-[var(--skin-border,#e2e8f0)] bg-transparent text-[var(--skin-header-text,#0f172a)] font-mono"
          maxLength={7}
        />
      </div>
    </div>
  );
}

export function AppearanceSettings() {
  const { activeSkinId, allSkins, setSkin, addCustomSkin, removeCustomSkin } = useSkin();
  const [showCreator, setShowCreator] = useState(false);
  const [newName, setNewName] = useState("");
  const [colors, setColors] = useState({ bg: "#0d1117", surface: "#161b22", accent: "#58a6ff", text: "#e6edf3" });

  const previewSkin: Skin = {
    id: "__preview__",
    name: newName || "Mi Skin",
    description: "Previsualización",
    type: "custom",
    preview: { bg: colors.bg, surface: colors.surface, accent: colors.accent, text: colors.text },
  };

  function handleCreate() {
    if (!newName.trim()) return;
    const id = `custom-${Date.now()}`;
    const skin: Skin = {
      id,
      name: newName.trim(),
      description: "Skin personalizado",
      type: "custom",
      preview: { ...colors },
      vars: deriveSkinVars(colors.bg, colors.surface, colors.accent, colors.text),
    };
    addCustomSkin(skin);
    setSkin(id);
    setShowCreator(false);
    setNewName("");
    setColors({ bg: "#0d1117", surface: "#161b22", accent: "#58a6ff", text: "#e6edf3" });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-[var(--skin-header-text,#0f172a)] mb-1">Apariencia</h2>
        <p className="text-xs text-[var(--skin-header-text-muted,#64748b)]">Elige un skin para personalizar la interfaz.</p>
      </div>

      {/* Skin grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {allSkins.map((skin) => (
          <SkinCard
            key={skin.id}
            skin={skin}
            active={activeSkinId === skin.id}
            onSelect={() => setSkin(skin.id)}
            onDelete={skin.type === "custom" ? () => removeCustomSkin(skin.id) : undefined}
          />
        ))}
        <NewSkinCard onClick={() => setShowCreator((v) => !v)} />
      </div>

      {/* Skin creator */}
      {showCreator && (
        <div className="rounded-xl border border-[var(--skin-border,#e2e8f0)] bg-white dark:bg-slate-800 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-[var(--skin-header-text,#0f172a)]">Crear Skin</h3>

          <div className="flex gap-6 flex-col sm:flex-row">
            {/* Controls */}
            <div className="flex-1 space-y-3">
              <div>
                <label className="text-xs text-[var(--skin-header-text-muted,#64748b)] mb-1 block">Nombre</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Mi skin..."
                  className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--skin-border,#e2e8f0)] bg-transparent text-[var(--skin-header-text,#0f172a)] placeholder-[var(--skin-header-text-muted,#94a3b8)]"
                />
              </div>
              <ColorField label="Fondo" value={colors.bg} onChange={(v) => setColors((c) => ({ ...c, bg: v }))} />
              <ColorField label="Superficie" value={colors.surface} onChange={(v) => setColors((c) => ({ ...c, surface: v }))} />
              <ColorField label="Acento / Neon" value={colors.accent} onChange={(v) => setColors((c) => ({ ...c, accent: v }))} />
              <ColorField label="Texto" value={colors.text} onChange={(v) => setColors((c) => ({ ...c, text: v }))} />
            </div>

            {/* Preview */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-[var(--skin-header-text-muted,#64748b)]">Preview</p>
              <div style={{ transform: "scale(2.5)", transformOrigin: "top center", marginBottom: "56px" }}>
                <SkinMiniPreview preview={previewSkin.preview} />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--skin-active-bg,#1e3a5f)] text-[var(--skin-active-text,#fff)] hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Crear
            </button>
            <button
              onClick={() => setShowCreator(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--skin-header-text-muted,#64748b)] hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
