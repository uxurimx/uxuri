import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/auth";

// GET /api/mkt/server/status
// Proxea el estado del mkt-server Python hacia el cliente.
export async function GET() {
  await requireAccess("/marketing");

  const serverUrl = process.env.MKT_SERVER_URL;
  const serverKey = process.env.MKT_SERVER_KEY;

  if (!serverUrl || !serverKey) {
    return NextResponse.json(
      { connected: false, error: "MKT_SERVER_URL o MKT_SERVER_KEY no configurados en .env.local" },
      { status: 200 }
    );
  }

  try {
    const res = await fetch(`${serverUrl.replace(/\/$/, "")}/api/status`, {
      headers:  { "X-API-Key": serverKey },
      cache:    "no-store",
      signal:   AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { connected: false, error: `HTTP ${res.status} del mkt-server` },
        { status: 200 }
      );
    }
    return NextResponse.json({ connected: true, ...(await res.json()) });
  } catch {
    return NextResponse.json(
      { connected: false, error: "Sin respuesta del mkt-server (¿está corriendo?)" },
      { status: 200 }
    );
  }
}
