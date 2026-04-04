"use client";

import { useEffect, useState } from "react";
import Pusher from "pusher-js";

interface ProgressState {
  sent: number;
  failed: number;
  total: number | null;
  scraped: number | null;
  pct: number | null;
  status: string;
  done: boolean;
  error: string | null;
}

interface CampaignProgressProps {
  campaignId: string;
  initialStatus: string;
  initialContacted: number;
  initialTotal: number;
  onStatusChange?: (status: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  queued:   "En cola — esperando worker…",
  claimed:  "Worker tomó la campaña…",
  scraping: "Scrapeando Google Maps…",
  running:  "Enviando mensajes…",
};

export function CampaignProgress({
  campaignId,
  initialStatus,
  initialContacted,
  initialTotal,
  onStatusChange,
}: CampaignProgressProps) {
  const [progress, setProgress] = useState<ProgressState>({
    sent:    initialContacted,
    failed:  0,
    total:   initialTotal || null,
    scraped: null,
    pct:     initialTotal > 0 ? Math.round((initialContacted / initialTotal) * 100) : null,
    status:  initialStatus,
    done:    false,
    error:   null,
  });

  useEffect(() => {
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    });

    const channel = pusher.subscribe("mkt-campaigns");
    const event   = `campaign:${campaignId}:progress`;

    channel.bind(event, (data: Partial<ProgressState>) => {
      setProgress((prev) => ({
        ...prev,
        sent:    data.sent    ?? prev.sent,
        failed:  data.failed  ?? prev.failed,
        total:   data.total   ?? prev.total,
        scraped: data.scraped ?? prev.scraped,
        pct:     data.pct     ?? prev.pct,
        status:  data.status  ?? prev.status,
        done:    data.done    ?? prev.done,
        error:   data.error   ?? prev.error,
      }));
      if (data.status && onStatusChange) onStatusChange(data.status);
    });

    return () => {
      channel.unbind(event);
      pusher.unsubscribe("mkt-campaigns");
      pusher.disconnect();
    };
  }, [campaignId, onStatusChange]);

  const { sent, failed, total, scraped, pct, status, done, error } = progress;
  const label = STATUS_LABELS[status] ?? status;
  const pctDisplay = pct ?? (total && total > 0 ? Math.round((sent / total) * 100) : 0);

  if (done && error) {
    return (
      <div className="mt-3 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
        <p className="text-xs text-red-700 font-medium">✗ Error: {error}</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mt-3 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-3">
        <span className="text-emerald-700 text-xs font-medium">✓ Completada</span>
        <span className="text-emerald-600 text-xs">{sent} enviados · {failed} fallidos</span>
        {scraped != null && scraped > 0 && (
          <span className="text-slate-500 text-xs">{scraped} scrapeados</span>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 animate-pulse">{label}</span>
        <span className="text-xs font-medium text-slate-700">
          {sent.toLocaleString()}{total ? ` / ${total.toLocaleString()}` : ""}
          {failed > 0 && <span className="text-red-500 ml-1">({failed} fallidos)</span>}
        </span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        {status === "scraping" ? (
          // Barra indeterminada durante scraping
          <div className="h-full bg-cyan-400 rounded-full animate-[progress_1.5s_ease-in-out_infinite]"
               style={{ width: "40%" }} />
        ) : (
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(pctDisplay, 100)}%` }}
          />
        )}
      </div>
      {scraped != null && scraped > 0 && status === "scraping" && (
        <p className="text-xs text-cyan-600">{scraped} leads encontrados…</p>
      )}
    </div>
  );
}
