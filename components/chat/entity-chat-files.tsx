"use client";

import { useEffect, useState } from "react";
import { MessageSquare, FolderOpen, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageThread } from "./message-thread";
import { FileSpace } from "@/components/files/file-space";

type Tab = "chat" | "files";

interface EntityChatFilesProps {
  entityId: string;
  entityType: "client" | "project";
  entityName: string;
  currentUserId: string;
}

export function EntityChatFiles({ entityId, entityType, entityName, currentUserId }: EntityChatFilesProps) {
  const [tab, setTab] = useState<Tab>("chat");
  const [channelId, setChannelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({ entityId, entityType, entityName });
    fetch(`/api/chat/channels/by-entity?${params}`)
      .then((r) => r.json())
      .then((data) => setChannelId(data?.id ?? null))
      .finally(() => setLoading(false));
  }, [entityId, entityType, entityName]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm p-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando...
      </div>
    );
  }

  if (!channelId) {
    return (
      <p className="text-slate-400 text-sm p-4">
        No se pudo iniciar el canal de chat.
      </p>
    );
  }

  return (
    <div className="flex flex-col h-[420px] md:h-[520px]">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 flex-shrink-0">
        <TabBtn active={tab === "chat"} onClick={() => setTab("chat")} icon={<MessageSquare className="w-4 h-4" />} label="Chat" />
        <TabBtn active={tab === "files"} onClick={() => setTab("files")} icon={<FolderOpen className="w-4 h-4" />} label="Archivos" />
      </div>

      {tab === "chat" ? (
        <MessageThread channelId={channelId} currentUserId={currentUserId} />
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <FileSpace channelId={channelId} />
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active, onClick, icon, label,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
        active
          ? "border-[#1e3a5f] text-[#1e3a5f]"
          : "border-transparent text-slate-500 hover:text-slate-700"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
