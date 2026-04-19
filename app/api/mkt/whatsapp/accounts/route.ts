import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/auth";
import { z } from "zod";

function mktServer() {
  const url = process.env.MKT_SERVER_URL;
  const key = process.env.MKT_SERVER_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

// GET /api/mkt/whatsapp/accounts
// Lista las sesiones de WhatsApp disponibles en el mkt-server.
export async function GET() {
  await requireAccess("/marketing");

  const srv = mktServer();
  if (!srv) {
    return NextResponse.json(
      { error: "MKT_SERVER_URL / MKT_SERVER_KEY no configurados en el servidor" },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(`${srv.url}/api/accounts`, {
      headers: { "X-API-Key": srv.key },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "No se pudo contactar al mkt-server" }, { status: 502 });
  }
}

const loginSchema = z.object({
  phone: z.string().min(8).max(20),
});

// POST /api/mkt/whatsapp/accounts
// Inicia el proceso de login QR para un número nuevo en el mkt-server.
export async function POST(req: Request) {
  await requireAccess("/marketing");

  const body = await req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "phone inválido" }, { status: 400 });
  }

  const srv = mktServer();
  if (!srv) {
    return NextResponse.json(
      { error: "MKT_SERVER_URL / MKT_SERVER_KEY no configurados" },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(
      `${srv.url}/api/accounts/${encodeURIComponent(parsed.data.phone)}/login`,
      { method: "POST", headers: { "X-API-Key": srv.key } }
    );
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: "No se pudo contactar al mkt-server" }, { status: 502 });
  }
}
