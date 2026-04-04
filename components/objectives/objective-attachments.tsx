"use client";

import { useState } from "react";
import { useUploadThing } from "@/lib/uploadthing-react";
import { Paperclip, Trash2, Upload, Eye } from "lucide-react";
import { FileViewerModal } from "@/components/ui/file-viewer-modal";

interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number | null;
  type: string | null;
  createdAt: string | Date;
}

interface ObjectiveAttachmentsProps {
  objectiveId: string;
  initialAttachments: Attachment[];
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ObjectiveAttachments({
  objectiveId,
  initialAttachments,
}: ObjectiveAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [viewerFile, setViewerFile] = useState<{ url: string; name: string; type?: string | null } | null>(null);

  const { startUpload } = useUploadThing("objectiveUploads", {
    onUploadBegin: () => setUploading(true),
    onClientUploadComplete: async (res) => {
      for (const file of res) {
        const body = {
          url: file.ufsUrl || file.url,
          name: file.name,
          size: file.size,
          type: file.type,
        };
        const r = await fetch(`/api/objectives/${objectiveId}/attachments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (r.ok) {
          const att = await r.json();
          setAttachments((prev) => [...prev, att]);
        }
      }
      setUploading(false);
    },
    onUploadError: () => setUploading(false),
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    await startUpload(Array.from(files));
  }

  async function deleteAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/objectives/${objectiveId}/attachments/${id}`, { method: "DELETE" });
  }

  return (
    <div className="space-y-4">
      {viewerFile && (
        <FileViewerModal
          file={viewerFile}
          allFiles={attachments.map((a) => ({ url: a.url, name: a.name, type: a.type }))}
          onClose={() => setViewerFile(null)}
        />
      )}

      {/* Dropzone */}
      <label
        className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
          dragOver
            ? "border-[#1e3a5f] bg-[#1e3a5f]/5"
            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="w-6 h-6 text-slate-400" />
        <span className="text-sm text-slate-500">
          {uploading ? "Subiendo..." : "Arrastra archivos o haz clic para seleccionar"}
        </span>
        <span className="text-xs text-slate-400">Imágenes, PDF, archivos (máx. 32 MB)</span>
        <input
          type="file"
          className="hidden"
          multiple
          disabled={uploading}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>

      {/* List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-3 p-3 border border-slate-100 rounded-lg hover:border-slate-200 transition-colors group"
            >
              <Paperclip className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">{att.name}</p>
                {att.size && (
                  <p className="text-xs text-slate-400">{formatSize(att.size)}</p>
                )}
              </div>
              <button
                onClick={() => setViewerFile({ url: att.url, name: att.name, type: att.type })}
                className="text-slate-400 hover:text-[#1e3a5f] transition-colors"
                title="Ver archivo"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => deleteAttachment(att.id)}
                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                title="Eliminar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
