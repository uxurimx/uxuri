import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/auth";

// POST /api/mkt/jobs/[jobId]/stop
// Detiene un job en ejecución en el mkt-server.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  await requireAccess("/marketing");
  const { jobId } = await params;

  const serverUrl = process.env.MKT_SERVER_URL;
  const serverKey = process.env.MKT_SERVER_KEY;

  if (!serverUrl || !serverKey) {
    return NextResponse.json({ error: "MKT_SERVER_URL no configurado" }, { status: 503 });
  }

  try {
    const res = await fetch(
      `${serverUrl.replace(/\/$/, "")}/api/jobs/${jobId}/stop`,
      { method: "POST", headers: { "X-API-Key": serverKey }, signal: AbortSignal.timeout(8000) }
    );
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: "No se pudo contactar al mkt-server" }, { status: 502 });
  }
}
