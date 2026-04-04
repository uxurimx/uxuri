import { NextResponse } from "next/server";

/**
 * Valida la API Key para los endpoints del bridge Python → Neon.
 * Configura MKT_API_KEY en .env.local.
 * La app Python envía: X-API-Key: <clave>
 */
export function validateMktApiKey(req: Request): boolean {
  const key = process.env.MKT_API_KEY;
  if (!key) return false;
  const header = req.headers.get("X-API-Key");
  return header === key;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "API key inválida o ausente" }, { status: 401 });
}
