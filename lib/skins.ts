// ─── Color utilities ──────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] | null {
  const c = hex.replace("#", "").trim();
  if (c.length !== 6) return null;
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function lightenHex(hex: string, t: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(rgb[0] + (255 - rgb[0]) * t, rgb[1] + (255 - rgb[1]) * t, rgb[2] + (255 - rgb[2]) * t);
}

export function darkenHex(hex: string, t: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(rgb[0] * (1 - t), rgb[1] * (1 - t), rgb[2] * (1 - t));
}

export function withAlpha(hex: string, a: number): string {
  const h = (hex.startsWith("#") ? hex : "#" + hex).slice(0, 7);
  return h + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0");
}

export function isColorDark(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 < 0.5;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SkinVars {
  // Fondo y layout
  pageBackground: string;
  contentBackground: string;
  // Barra lateral
  sidebarBackground: string;
  sidebarBorder: string;
  sidebarText: string;
  sidebarTextMuted: string;
  sidebarHover: string;
  activeBg: string;
  activeText: string;
  // Encabezado
  headerBackground: string;
  headerBorder: string;
  headerText: string;
  headerTextMuted: string;
  headerTextStrong: string;
  // Tarjetas y paneles
  cardBackground: string;
  cardBorder: string;
  cardText: string;
  cardTextMuted: string;
  // Tablas
  tableHeaderBg: string;
  tableHeaderText: string;
  tableRowHover: string;
  tableBorder: string;
  // Formularios
  inputBackground: string;
  inputBorder: string;
  inputText: string;
  inputFocusRing: string;
  // Botón principal
  buttonBg: string;
  buttonText: string;
  buttonHover: string;
  // Texto global
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  // Bordes globales
  borderColor: string;
  dividerColor: string;
  // Estados semánticos
  danger:       string;
  dangerBg:     string;
  warning:      string;
  warningBg:    string;
  success:      string;
  successBg:    string;
  info:         string;
  infoBg:       string;
  // Barras de progreso
  progressBar:   string;
  progressTrack: string;
  progressDone:  string;
  // Puntos de prioridad
  dotUrgent: string;
  dotHigh:   string;
  dotMedium: string;
  dotLow:    string;
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

// ─── Group definitions (used in the creator UI) ───────────────────────────────

export interface SkinFieldDef {
  key: keyof SkinVars;
  label: string;
  hint?: string;
}

export interface SkinGroupDef {
  id: string;
  emoji: string;
  label: string;
  description: string;
  fields: SkinFieldDef[];
}

export const SKIN_GROUPS: SkinGroupDef[] = [
  {
    id: "base",
    emoji: "🌐",
    label: "Base",
    description: "Fondo principal de la aplicación",
    fields: [
      { key: "pageBackground",   label: "Fondo de página",     hint: "Color detrás de todo el contenido" },
      { key: "contentBackground",label: "Área de contenido",   hint: "Zona donde viven las listas y tarjetas" },
      { key: "borderColor",      label: "Bordes generales",    hint: "Líneas entre secciones" },
      { key: "dividerColor",     label: "Divisores",           hint: "Separadores dentro de listas" },
    ],
  },
  {
    id: "sidebar",
    emoji: "📌",
    label: "Barra lateral",
    description: "Menú de navegación izquierdo",
    fields: [
      { key: "sidebarBackground", label: "Fondo",              hint: "Fondo del menú lateral" },
      { key: "sidebarBorder",     label: "Borde",              hint: "Línea que separa el menú del contenido" },
      { key: "sidebarText",       label: "Texto del menú",     hint: "Color de los links del menú" },
      { key: "sidebarTextMuted",  label: "Texto secundario",   hint: "Labels y textos de apoyo en el menú" },
      { key: "sidebarHover",      label: "Hover de item",      hint: "Color al pasar el cursor sobre un item" },
      { key: "activeBg",          label: "Item activo — fondo",hint: "Fondo del item seleccionado" },
      { key: "activeText",        label: "Item activo — texto",hint: "Color del item seleccionado (también es tu acento)" },
    ],
  },
  {
    id: "header",
    emoji: "🔝",
    label: "Encabezado",
    description: "Barra superior de la aplicación",
    fields: [
      { key: "headerBackground",   label: "Fondo",           hint: "Fondo del topbar" },
      { key: "headerBorder",       label: "Borde inferior",  hint: "Línea debajo del header" },
      { key: "headerText",         label: "Texto principal", hint: "Nombre del usuario, títulos" },
      { key: "headerTextMuted",    label: "Texto secundario",hint: "Breadcrumbs, subtítulos" },
      { key: "headerTextStrong",   label: "Texto destacado", hint: "Contadores, notificaciones" },
    ],
  },
  {
    id: "cards",
    emoji: "🃏",
    label: "Tarjetas",
    description: "Paneles, cards y secciones de contenido",
    fields: [
      { key: "cardBackground",  label: "Fondo",            hint: "Fondo de tarjetas y paneles" },
      { key: "cardBorder",      label: "Borde",            hint: "Contorno de las tarjetas" },
      { key: "cardText",        label: "Texto principal",  hint: "Títulos y texto dentro de tarjetas" },
      { key: "cardTextMuted",   label: "Texto secundario", hint: "Descripciones y metadata" },
    ],
  },
  {
    id: "tables",
    emoji: "📊",
    label: "Tablas",
    description: "Vistas de lista y tablas de datos",
    fields: [
      { key: "tableHeaderBg",   label: "Fondo de cabecera",  hint: "Fila de títulos de columna" },
      { key: "tableHeaderText", label: "Texto de cabecera",  hint: "Títulos de columna" },
      { key: "tableRowHover",   label: "Hover de fila",      hint: "Fondo al pasar el cursor sobre una fila" },
      { key: "tableBorder",     label: "Borde de tabla",     hint: "Líneas que separan filas y columnas" },
    ],
  },
  {
    id: "forms",
    emoji: "✏️",
    label: "Formularios",
    description: "Inputs, selects y campos de texto",
    fields: [
      { key: "inputBackground", label: "Fondo de input",    hint: "Interior de los campos de texto" },
      { key: "inputBorder",     label: "Borde de input",    hint: "Contorno de los campos" },
      { key: "inputText",       label: "Texto de input",    hint: "Lo que escribe el usuario" },
      { key: "inputFocusRing",  label: "Anillo de foco",    hint: "Resaltado cuando el campo está activo" },
    ],
  },
  {
    id: "buttons",
    emoji: "🔘",
    label: "Botón principal",
    description: "Acciones primarias (Crear, Guardar…)",
    fields: [
      { key: "buttonBg",   label: "Fondo",  hint: "Color del botón de acción principal" },
      { key: "buttonText", label: "Texto",  hint: "Texto encima del botón" },
      { key: "buttonHover",label: "Hover",  hint: "Color al pasar el cursor" },
    ],
  },
  {
    id: "text",
    emoji: "📝",
    label: "Texto",
    description: "Jerarquía de texto en el contenido",
    fields: [
      { key: "textPrimary",   label: "Texto principal",  hint: "Títulos, headings, datos importantes" },
      { key: "textSecondary", label: "Texto secundario", hint: "Subtítulos, labels" },
      { key: "textMuted",     label: "Texto suave",      hint: "Fechas, placeholders, metadata" },
    ],
  },
  {
    id: "states",
    emoji: "🚦",
    label: "Estados",
    description: "Colores semánticos: éxito, alerta, peligro e info",
    fields: [
      { key: "success",   label: "Éxito — texto",   hint: "Color de texto para estados positivos/completados" },
      { key: "successBg", label: "Éxito — fondo",   hint: "Fondo de tarjetas y badges de éxito" },
      { key: "warning",   label: "Alerta — texto",  hint: "Color de texto para advertencias y tareas urgentes" },
      { key: "warningBg", label: "Alerta — fondo",  hint: "Fondo de tarjetas y badges de alerta" },
      { key: "danger",    label: "Peligro — texto", hint: "Color de texto para errores y vencidos" },
      { key: "dangerBg",  label: "Peligro — fondo", hint: "Fondo de tarjetas y badges de peligro" },
      { key: "info",      label: "Info — texto",    hint: "Color de texto para información y objetivos completos" },
      { key: "infoBg",    label: "Info — fondo",    hint: "Fondo de tarjetas y badges informativos" },
    ],
  },
  {
    id: "priorities",
    emoji: "🎯",
    label: "Prioridades y progreso",
    description: "Dots de prioridad y barras de progreso",
    fields: [
      { key: "dotUrgent",     label: "Dot urgente",       hint: "Punto de color para prioridad urgente" },
      { key: "dotHigh",       label: "Dot alta",          hint: "Punto de color para prioridad alta" },
      { key: "dotMedium",     label: "Dot media",         hint: "Punto de color para prioridad media" },
      { key: "dotLow",        label: "Dot baja",          hint: "Punto de color para prioridad baja" },
      { key: "progressBar",   label: "Barra de progreso", hint: "Color del relleno de las barras de progreso" },
      { key: "progressTrack", label: "Fondo de barra",    hint: "Color del fondo (pista) de las barras de progreso" },
      { key: "progressDone",  label: "Progreso 100%",     hint: "Color cuando una tarea o proyecto está completo" },
    ],
  },
];

// ─── Derive all vars from 4 base colors ───────────────────────────────────────

export const DARK_BASE  = { bg: "#0d1117", surface: "#161b22", accent: "#58a6ff", text: "#e6edf3" };
export const LIGHT_BASE = { bg: "#f8fafc", surface: "#ffffff", accent: "#1e3a5f", text: "#0f172a" };

export function deriveSkinVars(
  bg: string,
  surface: string,
  accent: string,
  text: string
): SkinVars {
  const dark = isColorDark(bg);
  const btnText = isColorDark(accent) ? "#ffffff" : "#000000";

  return {
    pageBackground:    bg,
    contentBackground: dark ? lightenHex(bg, 0.05)  : "#f1f5f9",
    sidebarBackground: surface,
    sidebarBorder:     dark ? lightenHex(surface, 0.12) : darkenHex(bg, 0.06),
    sidebarText:       withAlpha(text, 0.72),
    sidebarTextMuted:  withAlpha(text, 0.38),
    sidebarHover:      dark ? lightenHex(surface, 0.07) : darkenHex(bg, 0.04),
    activeBg:          withAlpha(accent, dark ? 0.18 : 0.12),
    activeText:        accent,
    headerBackground:  dark ? surface : "#ffffff",
    headerBorder:      dark ? lightenHex(surface, 0.1) : "#e2e8f0",
    headerText:        text,
    headerTextMuted:   withAlpha(text, 0.58),
    headerTextStrong:  text,
    cardBackground:    dark ? lightenHex(bg, 0.07) : "#ffffff",
    cardBorder:        dark ? lightenHex(bg, 0.2)  : "#e2e8f0",
    cardText:          text,
    cardTextMuted:     withAlpha(text, 0.62),
    tableHeaderBg:     dark ? lightenHex(bg, 0.1)  : "#f8fafc",
    tableHeaderText:   withAlpha(text, 0.6),
    tableRowHover:     withAlpha(accent, 0.07),
    tableBorder:       dark ? lightenHex(bg, 0.18) : "#e2e8f0",
    inputBackground:   dark ? lightenHex(bg, 0.08) : "#ffffff",
    inputBorder:       dark ? lightenHex(bg, 0.28) : "#cbd5e1",
    inputText:         text,
    inputFocusRing:    withAlpha(accent, 0.45),
    buttonBg:          accent,
    buttonText:        btnText,
    buttonHover:       dark ? lightenHex(accent, 0.1) : darkenHex(accent, 0.1),
    textPrimary:       text,
    textSecondary:     withAlpha(text, 0.78),
    textMuted:         withAlpha(text, 0.5),
    borderColor:       dark ? lightenHex(bg, 0.2)  : "#e2e8f0",
    dividerColor:      dark ? lightenHex(bg, 0.1)  : "#f1f5f9",
    // Semantic states
    danger:       dark ? "#f87171" : "#dc2626",
    dangerBg:     dark ? withAlpha("#f87171", 0.12) : "#fef2f2",
    warning:      dark ? "#fb923c" : "#ea580c",
    warningBg:    dark ? withAlpha("#fb923c", 0.12) : "#fff7ed",
    success:      dark ? "#4ade80" : "#16a34a",
    successBg:    dark ? withAlpha("#4ade80", 0.12) : "#f0fdf4",
    info:         dark ? "#60a5fa" : "#2563eb",
    infoBg:       dark ? withAlpha("#60a5fa", 0.12) : "#eff6ff",
    // Progress bars
    progressBar:   accent,
    progressTrack: dark ? lightenHex(bg, 0.1) : "#f1f5f9",
    progressDone:  dark ? "#4ade80" : "#22c55e",
    // Priority dots
    dotUrgent: dark ? "#f87171" : "#ef4444",
    dotHigh:   dark ? "#fb923c" : "#f97316",
    dotMedium: "#fbbf24",
    dotLow:    dark ? withAlpha(text, 0.3) : "#94a3b8",
  };
}

// ─── Built-in skins ───────────────────────────────────────────────────────────

export const BUILTIN_SKINS: Skin[] = [
  {
    id: "default",
    name: "Default",
    description: "Tema claro del sistema",
    type: "builtin",
    preview: { bg: "#f8fafc", surface: "#ffffff", accent: "#1e3a5f", text: "#0f172a" },
  },
  {
    id: "torres",
    name: "Torres",
    description: "Oscuro tech — neon cyan sobre navy",
    type: "builtin",
    preview: { bg: "#07090f", surface: "#0d1117", accent: "#22d3ee", text: "#c9d1d9" },
  },
];

// ─── CSS var map ──────────────────────────────────────────────────────────────

export function skinVarsToCss(vars: SkinVars): Record<string, string> {
  return {
    "--skin-page-bg":            vars.pageBackground,
    "--skin-content-bg":         vars.contentBackground,
    "--skin-sidebar-bg":         vars.sidebarBackground,
    "--skin-sidebar-border":     vars.sidebarBorder,
    "--skin-sidebar-text":       vars.sidebarText,
    "--skin-sidebar-text-muted": vars.sidebarTextMuted,
    "--skin-active-bg":          vars.activeBg,
    "--skin-active-text":        vars.activeText,
    "--skin-sidebar-hover":      vars.sidebarHover,
    "--skin-header-bg":          vars.headerBackground,
    "--skin-header-border":      vars.headerBorder,
    "--skin-header-text":        vars.headerText,
    "--skin-header-text-muted":  vars.headerTextMuted,
    "--skin-header-text-strong": vars.headerTextStrong,
    "--skin-card-bg":            vars.cardBackground,
    "--skin-card-border":        vars.cardBorder,
    "--skin-card-text":          vars.cardText,
    "--skin-card-text-muted":    vars.cardTextMuted,
    "--skin-table-header-bg":    vars.tableHeaderBg,
    "--skin-table-header-text":  vars.tableHeaderText,
    "--skin-table-row-hover":    vars.tableRowHover,
    "--skin-table-border":       vars.tableBorder,
    "--skin-input-bg":           vars.inputBackground,
    "--skin-input-border":       vars.inputBorder,
    "--skin-input-text":         vars.inputText,
    "--skin-input-focus":        vars.inputFocusRing,
    "--skin-btn-bg":             vars.buttonBg,
    "--skin-btn-text":           vars.buttonText,
    "--skin-btn-hover":          vars.buttonHover,
    "--skin-text-primary":       vars.textPrimary,
    "--skin-text-secondary":     vars.textSecondary,
    "--skin-text-muted":         vars.textMuted,
    "--skin-border":             vars.borderColor,
    "--skin-divider":            vars.dividerColor,
    "--skin-danger":             vars.danger,
    "--skin-danger-bg":          vars.dangerBg,
    "--skin-warning":            vars.warning,
    "--skin-warning-bg":         vars.warningBg,
    "--skin-success":            vars.success,
    "--skin-success-bg":         vars.successBg,
    "--skin-info":               vars.info,
    "--skin-info-bg":            vars.infoBg,
    "--skin-progress-bar":       vars.progressBar,
    "--skin-progress-track":     vars.progressTrack,
    "--skin-progress-done":      vars.progressDone,
    "--skin-dot-urgent":         vars.dotUrgent,
    "--skin-dot-high":           vars.dotHigh,
    "--skin-dot-medium":         vars.dotMedium,
    "--skin-dot-low":            vars.dotLow,
  };
}

// ─── All var names (for clearing) ─────────────────────────────────────────────

export const ALL_SKIN_VAR_NAMES = Object.keys(
  skinVarsToCss({} as SkinVars)
) as string[];

// ─── localStorage helpers ─────────────────────────────────────────────────────

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
