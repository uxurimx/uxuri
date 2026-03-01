export interface SkinVars {
  pageBackground: string;
  sidebarBackground: string;
  sidebarBorder: string;
  sidebarText: string;
  sidebarTextMuted: string;
  activeBg: string;
  activeText: string;
  sidebarHover: string;
  headerBackground: string;
  headerText: string;
  headerTextMuted: string;
  headerTextStrong: string;
  borderColor: string;
}

export interface SkinPreview {
  bg: string;
  surface: string;
  accent: string;
  text: string;
}

export interface Skin {
  id: string;
  name: string;
  description: string;
  type: "builtin" | "custom";
  preview: SkinPreview;
  vars?: SkinVars;
}

export const BUILTIN_SKINS: Skin[] = [
  {
    id: "default",
    name: "Default",
    description: "Tema del sistema (claro/oscuro)",
    type: "builtin",
    preview: { bg: "#f8fafc", surface: "#ffffff", accent: "#1e3a5f", text: "#0f172a" },
  },
  {
    id: "torres",
    name: "Torres",
    description: "Oscuro tech — neon cyan sobre navy profundo",
    type: "builtin",
    preview: { bg: "#07090f", surface: "#0d1117", accent: "#22d3ee", text: "#c9d1d9" },
    vars: {
      pageBackground: "#07090f",
      sidebarBackground: "#0a0e1a",
      sidebarBorder: "#1a2233",
      sidebarText: "#8892a4",
      sidebarTextMuted: "#444f63",
      activeBg: "#0e2233",
      activeText: "#22d3ee",
      sidebarHover: "#111827",
      headerBackground: "#0a0e1a",
      headerText: "#c9d1d9",
      headerTextMuted: "#8892a4",
      headerTextStrong: "#e2e8f0",
      borderColor: "#1a2233",
    },
  },
];

export function skinVarsToCss(vars: SkinVars): Record<string, string> {
  return {
    "--skin-page-bg": vars.pageBackground,
    "--skin-sidebar-bg": vars.sidebarBackground,
    "--skin-sidebar-border": vars.sidebarBorder,
    "--skin-sidebar-text": vars.sidebarText,
    "--skin-sidebar-text-muted": vars.sidebarTextMuted,
    "--skin-active-bg": vars.activeBg,
    "--skin-active-text": vars.activeText,
    "--skin-sidebar-hover": vars.sidebarHover,
    "--skin-header-bg": vars.headerBackground,
    "--skin-header-text": vars.headerText,
    "--skin-header-text-muted": vars.headerTextMuted,
    "--skin-header-text-strong": vars.headerTextStrong,
    "--skin-border": vars.borderColor,
  };
}

const STORAGE_KEY = "uxuri:active-skin";
const CUSTOM_SKINS_KEY = "uxuri:custom-skins";

export function loadActiveSkinId(): string {
  if (typeof window === "undefined") return "default";
  return localStorage.getItem(STORAGE_KEY) ?? "default";
}

export function saveActiveSkinId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, id);
}

export function loadCustomSkins(): Skin[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_SKINS_KEY);
    return raw ? (JSON.parse(raw) as Skin[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomSkin(skin: Skin): void {
  if (typeof window === "undefined") return;
  const skins = loadCustomSkins().filter((s) => s.id !== skin.id);
  localStorage.setItem(CUSTOM_SKINS_KEY, JSON.stringify([...skins, skin]));
}

export function deleteCustomSkin(id: string): void {
  if (typeof window === "undefined") return;
  const skins = loadCustomSkins().filter((s) => s.id !== id);
  localStorage.setItem(CUSTOM_SKINS_KEY, JSON.stringify(skins));
}

/** Derive full SkinVars from 4 user-picked colors */
export function deriveSkinVars(bg: string, surface: string, accent: string, text: string): SkinVars {
  return {
    pageBackground: bg,
    sidebarBackground: surface,
    sidebarBorder: accent + "33",
    sidebarText: text + "aa",
    sidebarTextMuted: text + "55",
    activeBg: accent + "22",
    activeText: accent,
    sidebarHover: bg + "dd",
    headerBackground: surface,
    headerText: text,
    headerTextMuted: text + "99",
    headerTextStrong: text,
    borderColor: accent + "33",
  };
}
