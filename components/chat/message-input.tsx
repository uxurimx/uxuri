"use client";

import { useRef, useState } from "react";
import { Send, Paperclip, X, Loader2 } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-react";
import { cn } from "@/lib/utils";

interface UploadedFile {
  url: string;
  name: string;
  type: string;
  size: number;
}

interface MessageInputProps {
  onSend: (payload: { content?: string; file?: UploadedFile }) => Promise<void>;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [text, setText] = useState("");
  const [pendingFile, setPendingFile] = useState<UploadedFile | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startUpload, isUploading } = useUploadThing("chatFile", {
    onClientUploadComplete: (files) => {
      if (files[0]) {
        setPendingFile({
          url: files[0].ufsUrl,
          name: files[0].name,
          type: files[0].type,
          size: files[0].size,
        });
      }
    },
    onUploadError: () => alert("Error al subir el archivo. Intenta de nuevo."),
  });

  async function handleSend() {
    if (!text.trim() && !pendingFile) return;
    setSending(true);
    try {
      await onSend({ content: text.trim() || undefined, file: pendingFile ?? undefined });
      setText("");
      setPendingFile(null);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isBusy = sending || isUploading || disabled;

  return (
    <div className="border-t border-slate-200 bg-white p-3">
      {/* Pending file preview */}
      {pendingFile && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
          <span className="text-xs text-slate-600 flex-1 truncate">
            📎 {pendingFile.name}
          </span>
          <button
            onClick={() => setPendingFile(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {isUploading && (
        <div className="flex items-center gap-2 mb-2 px-3 py-1.5 text-xs text-blue-600">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Subiendo archivo...
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* File picker */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
          className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#1e3a5f] hover:bg-slate-100 transition-colors disabled:opacity-40"
          title="Adjuntar archivo"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) startUpload([file]);
            e.target.value = "";
          }}
        />

        {/* Text input */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje..."
          rows={1}
          disabled={isBusy}
          className={cn(
            "flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 max-h-24",
            isBusy && "opacity-50"
          )}
        />

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={isBusy || (!text.trim() && !pendingFile)}
          className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-[#1e3a5f] text-white hover:bg-[#162d4a] transition-colors disabled:opacity-40"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
