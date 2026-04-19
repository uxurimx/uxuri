import { db } from "@/db";
import { mktWorkers } from "@/db/schema";
import { desc } from "drizzle-orm";
import { requireAccess } from "@/lib/auth";
import { WorkersPanel } from "@/components/marketing/workers-panel";

export const dynamic = "force-dynamic";

export default async function WorkersPage() {
  await requireAccess("/marketing");

  // DB workers (registro de heartbeat de cada nodo)
  const dbWorkers = await db
    .select()
    .from(mktWorkers)
    .orderBy(desc(mktWorkers.lastHeartbeat))
    .limit(20);

  const dbWorkersSerial = dbWorkers.map((w) => ({
    id:                w.id,
    workerId:          w.workerId,
    hostname:          w.hostname,
    workerType:        w.workerType,
    status:            w.status,
    lastHeartbeat:     w.lastHeartbeat?.toISOString() ?? null,
    currentCampaignId: w.currentCampaignId ?? null,
    capabilities:      w.capabilities as string[] | null,
  }));

  // Estado del mkt-server (fetch directo, no pasa por el API route para evitar
  // la restricción de relative URLs en Server Components)
  const serverUrl = process.env.MKT_SERVER_URL;
  const serverKey = process.env.MKT_SERVER_KEY;

  let serverStatus: Record<string, unknown> = {
    connected: false,
    error: serverUrl
      ? "No se pudo conectar al mkt-server"
      : "MKT_SERVER_URL no configurado en .env.local",
  };

  if (serverUrl && serverKey) {
    try {
      const res = await fetch(`${serverUrl.replace(/\/$/, "")}/api/status`, {
        headers: { "X-API-Key": serverKey },
        cache:   "no-store",
        signal:  AbortSignal.timeout(5000),
      });
      if (res.ok) {
        serverStatus = { connected: true, ...(await res.json()) };
      }
    } catch {
      // serverStatus ya tiene el error por defecto
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (
    <WorkersPanel
      initialStatus={serverStatus as any}
      dbWorkers={dbWorkersSerial}
    />
  );
}
