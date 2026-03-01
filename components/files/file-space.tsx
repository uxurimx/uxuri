"use client";

import { useEffect, useState, useRef } from "react";
import { Download, FileText, Image as ImageIcon, Loader2, Upload } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-react";
import { formatDateTime } from "@/lib/utils";
import type { ChatMessage } from "@/db/schema";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(t: string | null) { return !!t?.startsWith("image/"); }

export function FileSpace({ channelId }: { channelId: string }) {
  const [files, setFiles] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "images" | "docs">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startUpload, isUploading } = useUploadThing("chatFile", {
    onClientUploadComplete: async (uploaded) => {
      if (!uploaded[0]) return;
      const f = uploaded[0];
      // Send as file message in the channel
      await fetch(`/api/chat/channels/${channelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl: f.ufsUrl,
          fileName: f.name,
          fileType: f.type,
          fileSize: f.size,
        }),
      });
      loadFiles();
    },
    onUploadError: () => alert("Error al subir el archivo."),
  });

  function loadFiles() {
    fetch(`/api/chat/channels/${channelId}/messages`)
      .then((r) => r.json())
      .then((data: ChatMessage[]) =>
        setFiles(Array.isArray(data) ? data.filter((m) => m.fileUrl) : [])
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadFiles(); }, [channelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = files.filter((f) => {
    if (filter === "images") return isImage(f.fileType);
    if (filter === "docs") return !isImage(f.fileType);
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(["all", "images", "docs"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                filter === tab
                  ? "bg-[#1e3a5f] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab === "all" ? "Todos" : tab === "images" ? "Imágenes" : "Documentos"}
            </button>
          ))}
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#162d4a] transition-colors disabled:opacity-50"
        >
          {isUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          {isUploading ? "Subiendo..." : "Subir archivo"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) startUpload([f]);
            e.target.value = "";
          }}
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando archivos...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <Upload className="w-10 h-10 mx-auto mb-2 text-slate-200" />
          <p className="text-sm">Sin archivos aún.</p>
          <p className="text-xs mt-1">Sube el primer archivo usando el botón de arriba</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((f) =>
            isImage(f.fileType) ? (
              <ImageCard key={f.id} file={f} />
            ) : (
              <DocCard key={f.id} file={f} />
            )
          )}
        </div>
      )}
    </div>
  );
}

function ImageCard({ file: f }: { file: ChatMessage }) {
  return (
    <a
      href={f.fileUrl!}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="aspect-square bg-slate-50 overflow-hidden">
        <img
          src={f.fileUrl!}
          alt={f.fileName ?? "imagen"}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
        />
      </div>
      <div className="p-2">
        <p className="text-xs font-medium text-slate-700 truncate">{f.fileName ?? "imagen"}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">
          {f.userName} · {formatDateTime(f.createdAt)}
        </p>
      </div>
    </a>
  );
}

function DocCard({ file: f }: { file: ChatMessage }) {
  return (
    <a
      href={f.fileUrl!}
      target="_blank"
      rel="noopener noreferrer"
      download={f.fileName ?? true}
      className="group flex flex-col bg-white rounded-xl border border-slate-200 p-3 hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-2">
        <FileText className="w-8 h-8 text-[#1e3a5f]" />
        <Download className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
      </div>
      <p className="text-xs font-medium text-slate-700 truncate flex-1">{f.fileName ?? "archivo"}</p>
      {f.fileSize && (
        <p className="text-[10px] text-slate-400 mt-0.5">{formatBytes(f.fileSize)}</p>
      )}
      <p className="text-[10px] text-slate-400 mt-0.5 truncate">{f.userName}</p>
    </a>
  );
}
