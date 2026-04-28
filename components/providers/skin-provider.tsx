"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useTheme } from "next-themes";
import type { SkinVars } from "@/lib/skins";
import {
  Skin,
  BUILTIN_SKINS,
  skinVarsToCss,
  ALL_SKIN_VAR_NAMES,
  loadActiveSkinId,
  saveActiveSkinId,
  loadCustomSkins,
  saveCustomSkin as persistCustomSkin,
  deleteCustomSkin as removeCustomSkinFromStorage,
} from "@/lib/skins";

// ─── CSS injection (concrete hex values — reliable across all Tailwind builds) ─

const STYLE_ID = "uxuri-custom-skin";

function buildOverrideCSS(v: SkinVars): string {
  const s = `[data-skin="custom"]`;
  return [
    `${s} body{background-color:${v.pageBackground};color:${v.textPrimary}}`,
    `${s} .bg-white{background-color:${v.cardBackground}!important}`,
    `${s} .bg-slate-50{background-color:${v.contentBackground}!important}`,
    `${s} .bg-slate-100{background-color:${v.contentBackground}!important}`,
    `${s} .bg-slate-200{background-color:${v.borderColor}!important}`,
    `${s} .border-slate-100{border-color:${v.dividerColor}!important}`,
    `${s} .border-slate-200{border-color:${v.cardBorder}!important}`,
    `${s} .border-slate-300{border-color:${v.cardBorder}!important}`,
    `${s} .divide-slate-100>*+*{border-color:${v.dividerColor}!important}`,
    `${s} .divide-slate-200>*+*{border-color:${v.dividerColor}!important}`,
    `${s} .text-slate-900{color:${v.textPrimary}!important}`,
    `${s} .text-slate-800{color:${v.textPrimary}!important}`,
    `${s} .text-slate-700{color:${v.textSecondary}!important}`,
    `${s} .text-slate-600{color:${v.textSecondary}!important}`,
    `${s} .text-slate-500{color:${v.textMuted}!important}`,
    `${s} .text-slate-400{color:${v.textMuted}!important}`,
    `${s} th{background-color:${v.tableHeaderBg}!important;color:${v.tableHeaderText}!important;border-color:${v.tableBorder}!important}`,
    `${s} td{border-color:${v.tableBorder}!important}`,
    `${s} .hover\\:bg-slate-50:hover{background-color:${v.tableRowHover}!important}`,
    `${s} .hover\\:bg-slate-100:hover{background-color:${v.tableRowHover}!important}`,
    `${s} input:not([type=checkbox]):not([type=radio]):not([type=color]),${s} select,${s} textarea{background-color:${v.inputBackground}!important;border-color:${v.inputBorder}!important;color:${v.inputText}!important}`,
    `${s} select option{background-color:${v.inputBackground};color:${v.inputText}}`,
    `${s} input:focus,${s} select:focus,${s} textarea:focus{border-color:${v.inputFocusRing}!important}`,
    `${s} .bg-blue-50,${s} .bg-emerald-50,${s} .bg-amber-50,${s} .bg-red-50{background-color:${v.contentBackground}!important}`,
    `html[data-skin="custom"]{--color-background:${v.pageBackground};--color-foreground:${v.textPrimary};--color-card:${v.cardBackground};--color-card-foreground:${v.cardText};--color-border:${v.cardBorder};--color-muted:${v.contentBackground};--color-muted-foreground:${v.textMuted}}`,
  ].join("\n");
}

function injectOverrideCSS(vars: SkinVars) {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = buildOverrideCSS(vars);
}

function clearOverrideCSS() {
  const el = document.getElementById(STYLE_ID);
  if (el) el.textContent = "";
}

// ─── DB sync helpers ──────────────────────────────────────────────────────────

async function fetchSkinFromDB(): Promise<{ activeSkinId: string; customSkins: Skin[] } | null> {
  try {
    const res = await fetch("/api/user/skin");
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function saveSkinToDB(activeSkinId?: string, customSkins?: Skin[]) {
  const body: Record<string, unknown> = {};
  if (activeSkinId !== undefined) body.activeSkinId = activeSkinId;
  if (customSkins  !== undefined) body.customSkins  = customSkins;
  fetch("/api/user/skin", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface SkinContextValue {
  activeSkinId: string;
  allSkins: Skin[];
  setSkin: (id: string) => void;
  addCustomSkin: (skin: Skin) => void;
  removeCustomSkin: (id: string) => void;
}

const SkinContext = createContext<SkinContextValue | null>(null);

export function useSkin() {
  const ctx = useContext(SkinContext);
  if (!ctx) throw new Error("useSkin must be used inside SkinProvider");
  return ctx;
}

// ─── CSS var helpers ──────────────────────────────────────────────────────────

function clearCssVars() {
  const html = document.documentElement;
  ALL_SKIN_VAR_NAMES.forEach((v) => html.style.removeProperty(v));
}

function applyCssVars(vars: Record<string, string>) {
  const html = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => html.style.setProperty(k, v));
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SkinProvider({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();
  const [activeSkinId, setActiveSkinId] = useState("default");
  const [customSkins, setCustomSkins]   = useState<Skin[]>([]);
  // Keep a ref so async callbacks always have latest value without stale closures
  const customSkinsRef = useRef<Skin[]>([]);

  const allSkins: Skin[] = [...BUILTIN_SKINS, ...customSkins];

  const applySkin = useCallback(
    (id: string, skins: Skin[]) => {
      const html = document.documentElement;
      const skin = skins.find((s) => s.id === id) ?? BUILTIN_SKINS[0];

      if (skin.id === "default") {
        html.removeAttribute("data-skin");
        html.classList.remove("dark");
        clearCssVars();
        clearOverrideCSS();
        const savedTheme = localStorage.getItem("theme") ?? "system";
        setTheme(savedTheme);
      } else if (skin.type === "builtin") {
        html.setAttribute("data-skin", skin.id);
        html.classList.add("dark");
        clearCssVars();
        clearOverrideCSS();
      } else {
        html.setAttribute("data-skin", "custom");
        html.classList.add("dark");
        if (skin.vars) {
          applyCssVars(skinVarsToCss(skin.vars));
          injectOverrideCSS(skin.vars);
        }
      }
    },
    [setTheme]
  );

  // On mount: apply from localStorage immediately, then sync from DB
  useEffect(() => {
    const localCustom = loadCustomSkins();
    const localId     = loadActiveSkinId();

    setCustomSkins(localCustom);
    customSkinsRef.current = localCustom;
    setActiveSkinId(localId);
    applySkin(localId, [...BUILTIN_SKINS, ...localCustom]);

    // Background DB sync — DB is source of truth across devices
    fetchSkinFromDB().then((data) => {
      if (!data) return;
      const { activeSkinId: dbId, customSkins: dbCustom } = data;

      // Persist DB values to localStorage so next load is also fast
      for (const s of dbCustom) persistCustomSkin(s);
      saveActiveSkinId(dbId);

      // Apply if different from what localStorage had
      const allDbSkins = [...BUILTIN_SKINS, ...dbCustom];
      setCustomSkins(dbCustom);
      customSkinsRef.current = dbCustom;
      setActiveSkinId(dbId);
      applySkin(dbId, allDbSkins);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSkin = useCallback(
    (id: string) => {
      setActiveSkinId(id);
      saveActiveSkinId(id);
      applySkin(id, [...BUILTIN_SKINS, ...customSkinsRef.current]);
      saveSkinToDB(id);
    },
    [applySkin]
  );

  const addCustomSkin = useCallback(
    (skin: Skin) => {
      persistCustomSkin(skin);
      setCustomSkins((prev) => {
        const next = [...prev.filter((s) => s.id !== skin.id), skin];
        customSkinsRef.current = next;
        saveSkinToDB(undefined, next);
        return next;
      });
    },
    []
  );

  const handleRemoveCustomSkin = useCallback(
    (id: string) => {
      removeCustomSkinFromStorage(id);
      setCustomSkins((prev) => {
        const next = prev.filter((s) => s.id !== id);
        customSkinsRef.current = next;
        saveSkinToDB(undefined, next);
        return next;
      });
      if (activeSkinId === id) setSkin("default");
    },
    [activeSkinId, setSkin]
  );

  return (
    <SkinContext.Provider
      value={{
        activeSkinId,
        allSkins,
        setSkin,
        addCustomSkin,
        removeCustomSkin: handleRemoveCustomSkin,
      }}
    >
      {children}
    </SkinContext.Provider>
  );
}
