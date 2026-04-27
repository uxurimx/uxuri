import { eq, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { getActiveWorkspaceId } from "@/lib/workspace";

/**
 * Retorna `eq(column, workspaceId)` para el workspace activo del usuario.
 * Estricto: NO incluye NULLs (la migración ya backfilló todos los datos).
 * Retorna undefined solo si el usuario no tiene workspaces (back-compat).
 */
export async function workspaceFilter(
  workspaceIdColumn: PgColumn
): Promise<SQL | undefined> {
  try {
    const wsId = await getActiveWorkspaceId();
    if (!wsId) return undefined;
    return eq(workspaceIdColumn, wsId);
  } catch {
    return undefined;
  }
}

/**
 * Alias — mismo comportamiento. Mantenido por compatibilidad con imports existentes.
 */
export const workspaceFilterStrict = workspaceFilter;

/**
 * El workspaceId activo para asociar a nuevos registros en POSTs.
 */
export async function resolveNewWorkspaceId(): Promise<string | null> {
  try {
    return await getActiveWorkspaceId();
  } catch {
    return null;
  }
}
