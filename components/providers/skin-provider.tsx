"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useTheme } from "next-themes";
import {
  Skin,
  BUILTIN_SKINS,
  skinVarsToCss,
  loadActiveSkinId,
  saveActiveSkinId,
  loadCustomSkins,
  saveCustomSkin as persistCustomSkin,
  deleteCustomSkin as removeCustomSkin,
} from "@/lib/skins";

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

function applyCustomVars(vars: Record<string, string>) {
  const html = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => html.style.setProperty(k, v));
}

function clearCustomVars() {
  const html = document.documentElement;
  const varNames = [
    "--skin-page-bg", "--skin-sidebar-bg", "--skin-sidebar-border",
    "--skin-sidebar-text", "--skin-sidebar-text-muted", "--skin-active-bg",
    "--skin-active-text", "--skin-sidebar-hover", "--skin-header-bg",
    "--skin-header-text", "--skin-header-text-muted", "--skin-header-text-strong",
    "--skin-border",
  ];
  varNames.forEach((v) => html.style.removeProperty(v));
}

export function SkinProvider({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();
  const [activeSkinId, setActiveSkinId] = useState("default");
  const [customSkins, setCustomSkins] = useState<Skin[]>([]);

  const allSkins: Skin[] = [...BUILTIN_SKINS, ...customSkins];

  // Apply skin to DOM
  const applySkin = useCallback(
    (id: string, skins: Skin[]) => {
      const html = document.documentElement;
      const skin = skins.find((s) => s.id === id) ?? BUILTIN_SKINS[0];

      if (skin.id === "default") {
        // Remove skin attr, clear inline vars, restore next-themes
        html.removeAttribute("data-skin");
        html.classList.remove("dark");
        clearCustomVars();
        const savedTheme = localStorage.getItem("theme") ?? "system";
        setTheme(savedTheme);
      } else if (skin.type === "builtin") {
        // Built-in non-default skin: CSS class handles vars via [data-skin="..."]
        html.setAttribute("data-skin", skin.id);
        html.classList.add("dark");
        clearCustomVars();
      } else {
        // Custom skin: apply vars inline
        html.setAttribute("data-skin", "custom");
        html.classList.add("dark");
        if (skin.vars) applyCustomVars(skinVarsToCss(skin.vars));
      }
    },
    [setTheme]
  );

  // Load from localStorage on mount
  useEffect(() => {
    const custom = loadCustomSkins();
    setCustomSkins(custom);
    const id = loadActiveSkinId();
    setActiveSkinId(id);
    applySkin(id, [...BUILTIN_SKINS, ...custom]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSkin = useCallback(
    (id: string) => {
      setActiveSkinId(id);
      saveActiveSkinId(id);
      applySkin(id, [...BUILTIN_SKINS, ...customSkins]);
    },
    [applySkin, customSkins]
  );

  const addCustomSkin = useCallback(
    (skin: Skin) => {
      persistCustomSkin(skin);
      setCustomSkins((prev) => {
        const next = [...prev.filter((s) => s.id !== skin.id), skin];
        return next;
      });
    },
    []
  );

  const handleRemoveCustomSkin = useCallback(
    (id: string) => {
      removeCustomSkin(id);
      setCustomSkins((prev) => prev.filter((s) => s.id !== id));
      if (activeSkinId === id) {
        setSkin("default");
      }
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
