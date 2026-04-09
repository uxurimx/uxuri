export type NavPrefs = {
  hiddenDesktop: string[];                   // hrefs ocultos en sidebar desktop
  hiddenMobile: string[];                    // hrefs ocultos en nav mobile
  groupItemOrder: Record<string, string[]>;  // groupId → hrefs ordenados por el usuario
};

const KEY = "uxuri-nav-prefs";

export const DEFAULT_PREFS: NavPrefs = {
  hiddenDesktop: [],
  hiddenMobile: [],
  groupItemOrder: {},
};

export function loadNavPrefs(): NavPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveNavPrefs(prefs: NavPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {}
}

/** Aplica el orden personalizado a un array de hrefs devolviendo hrefs ordenados. */
export function applyOrder(defaultHrefs: string[], customOrder: string[]): string[] {
  if (!customOrder.length) return defaultHrefs;
  const set = new Set(defaultHrefs);
  const ordered = customOrder.filter((h) => set.has(h));
  const rest = defaultHrefs.filter((h) => !customOrder.includes(h));
  return [...ordered, ...rest];
}
