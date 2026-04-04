import type { NavLayoutItem } from "@/db/schema";

export type { NavLayoutItem };

export interface NavItem {
  href: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
}

/**
 * Aplica el navLayout del usuario a la lista de items permitidos por roles.
 * - Si no hay layout, devuelve los items en orden por defecto.
 * - Items que aparecen en el layout con visible=false se ocultan.
 * - Items que aparecen en el layout se ordenan por su campo `order`.
 * - Items nuevos (no en el layout) se muestran al final en orden por defecto.
 */
export function applyNavLayout(
  permitted: NavItem[],
  layout: NavLayoutItem[] | null | undefined,
): NavItem[] {
  if (!layout || layout.length === 0) return permitted;

  const visibleSet  = new Set(layout.filter(l => l.visible).map(l => l.id));
  const orderMap    = new Map(layout.map(l => [l.id, l.order]));
  const inLayout    = new Set(layout.map(l => l.id));

  return permitted
    .filter(item => !inLayout.has(item.href) || visibleSet.has(item.href))
    .sort((a, b) => {
      const oa = orderMap.has(a.href) ? orderMap.get(a.href)! : 9999;
      const ob = orderMap.has(b.href) ? orderMap.get(b.href)! : 9999;
      return oa - ob;
    });
}

/**
 * Genera un layout inicial a partir de la lista de items en su orden actual.
 */
export function buildDefaultLayout(items: NavItem[]): NavLayoutItem[] {
  return items.map((item, i) => ({ id: item.href, visible: true, order: i }));
}
