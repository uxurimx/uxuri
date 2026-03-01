"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageSquare, Users, Briefcase, Hash, ArrowLeft, UserCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MessageThread } from "./message-thread";

type Channel = {
  id: string;
  name: string;
  entityType: string;
  entityId: string | null;
  dmKey: string | null;
  createdAt: string;
};

type Member = {
  id: string;
  name: string | null;
  imageUrl: string | null;
};

function ChannelIcon({ type }: { type: string }) {
  if (type === "client") return <Users className="w-4 h-4 flex-shrink-0" />;
  if (type === "project") return <Briefcase className="w-4 h-4 flex-shrink-0" />;
  if (type === "direct") return <UserCircle2 className="w-4 h-4 flex-shrink-0" />;
  return <Hash className="w-4 h-4 flex-shrink-0" />;
}

function MemberAvatar({ name }: { name: string | null }) {
  const initials = (name ?? "?").split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="w-6 h-6 rounded-full bg-slate-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
      {initials}
    </div>
  );
}

export function ChatClient({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeChannelId = searchParams.get("ch");

  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [openingDm, setOpeningDm] = useState<string | null>(null);
  const [showThread, setShowThread] = useState(false);

  useEffect(() => {
    fetch("/api/chat/channels")
      .then((r) => r.json())
      .then((data) => {
        setChannels(Array.isArray(data) ? data : []);
        if (!activeChannelId && Array.isArray(data) && data.length > 0) {
          const general = data.find((c: Channel) => c.entityType === "general") ?? data[0];
          router.replace(`/chat?ch=${general.id}`);
        }
      })
      .finally(() => setLoadingChannels(false));

    fetch("/api/chat/members")
      .then((r) => r.json())
      .then((data) => setMembers(Array.isArray(data) ? data : []));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeChannelId) setShowThread(true);
  }, [activeChannelId]);

  function selectChannel(id: string) {
    router.push(`/chat?ch=${id}`);
    setShowThread(true);
  }

  async function openDm(memberId: string) {
    setOpeningDm(memberId);
    const res = await fetch(`/api/chat/channels/direct?otherUserId=${memberId}`);
    const channel: Channel = await res.json();
    setChannels((prev) => prev.some((c) => c.id === channel.id) ? prev : [...prev, channel]);
    setOpeningDm(null);
    selectChannel(channel.id);
  }

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  const grouped = {
    general: channels.filter((c) => c.entityType === "general"),
    client: channels.filter((c) => c.entityType === "client"),
    project: channels.filter((c) => c.entityType === "project"),
    direct: channels.filter((c) => c.entityType === "direct"),
  };

  return (
    <div className="flex h-full min-h-0">
      {/* ── Left panel: channel list ────────────────────── */}
      <div
        className={cn(
          "w-full md:w-72 flex-shrink-0 bg-slate-900 flex flex-col border-r border-slate-800",
          "md:flex",
          showThread ? "hidden" : "flex"
        )}
      >
        <div className="h-14 flex items-center px-4 border-b border-slate-800">
          <MessageSquare className="w-5 h-5 text-[#4a7ab5] mr-2" />
          <span className="text-white font-semibold text-sm">Chat</span>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-4">
          {loadingChannels ? (
            <p className="text-slate-500 text-xs px-4">Cargando canales...</p>
          ) : (
            <>
              {grouped.general.length > 0 && (
                <ChannelGroup label="General" channels={grouped.general} activeId={activeChannelId} onSelect={selectChannel} />
              )}
              {grouped.direct.length > 0 && (
                <ChannelGroup label="Mensajes directos" channels={grouped.direct} activeId={activeChannelId} onSelect={selectChannel} />
              )}
              {grouped.client.length > 0 && (
                <ChannelGroup label="Clientes" channels={grouped.client} activeId={activeChannelId} onSelect={selectChannel} />
              )}
              {grouped.project.length > 0 && (
                <ChannelGroup label="Proyectos" channels={grouped.project} activeId={activeChannelId} onSelect={selectChannel} />
              )}
            </>
          )}

          {/* Users for new DMs */}
          {members.length > 0 && (
            <div>
              <p className="px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Usuarios
              </p>
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => openDm(m.id)}
                  disabled={openingDm === m.id}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white transition-colors text-left"
                >
                  {openingDm === m.id ? (
                    <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                  ) : (
                    <MemberAvatar name={m.name} />
                  )}
                  <span className="truncate">{m.name ?? "Usuario"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel: message thread ─────────────────── */}
      <div
        className={cn(
          "flex-1 flex flex-col min-h-0 bg-slate-50",
          "md:flex",
          showThread ? "flex" : "hidden"
        )}
      >
        <div className="h-14 flex items-center gap-3 px-4 bg-white border-b border-slate-200 flex-shrink-0">
          <button
            onClick={() => setShowThread(false)}
            className="md:hidden text-slate-400 hover:text-slate-600 mr-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          {activeChannel && (
            <>
              <ChannelIcon type={activeChannel.entityType} />
              <span className="font-semibold text-slate-800 text-sm">{activeChannel.name}</span>
              <span className="text-xs text-slate-400 capitalize">
                {activeChannel.entityType === "general"
                  ? "Canal general"
                  : activeChannel.entityType === "client"
                  ? "Cliente"
                  : activeChannel.entityType === "project"
                  ? "Proyecto"
                  : "Mensaje directo"}
              </span>
            </>
          )}
        </div>

        {activeChannelId ? (
          <MessageThread
            key={activeChannelId}
            channelId={activeChannelId}
            currentUserId={currentUserId}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400 flex-col gap-2">
            <MessageSquare className="w-10 h-10 text-slate-200" />
            <p className="text-sm">Selecciona un canal para chatear</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChannelGroup({
  label,
  channels,
  activeId,
  onSelect,
}: {
  label: string;
  channels: Channel[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <p className="px-4 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </p>
      {channels.map((ch) => (
        <button
          key={ch.id}
          onClick={() => onSelect(ch.id)}
          className={cn(
            "w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors text-left",
            ch.id === activeId
              ? "bg-[#1e3a5f] text-white"
              : "text-slate-400 hover:bg-slate-800 hover:text-white"
          )}
        >
          <ChannelIcon type={ch.entityType} />
          <span className="truncate">{ch.name}</span>
        </button>
      ))}
    </div>
  );
}
