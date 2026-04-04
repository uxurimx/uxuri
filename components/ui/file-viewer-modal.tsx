"use client";

import { useEffect, useState } from "react";
import { X, Download, FileText, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";

interface FileViewerFile {
  url: string;
  name: string;
  type?: string | null;
}

interface FileViewerModalProps {
  file: FileViewerFile;
  allFiles?: FileViewerFile[];
  onClose: () => void;
}

function isImageFile(type?: string | null, name?: string) {
  if (type?.startsWith("image/")) return true;
  return /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(name ?? "");
}

function isPdfFile(type?: string | null, name?: string) {
  if (type === "application/pdf") return true;
  return name?.toLowerCase().endsWith(".pdf");
}

export function FileViewerModal({ file, allFiles, onClose }: FileViewerModalProps) {
  const [current, setCurrent] = useState(file);
  const [zoom, setZoom] = useState(1);

  const files = allFiles ?? [file];
  const idx = files.findIndex((f) => f.url === current.url);
  const hasPrev = idx > 0;
  const hasNext = idx < files.length - 1;

  const isImage = isImageFile(current.type, current.name);
  const isPdf = isPdfFile(current.type, current.name);

  useEffect(() => {
    setZoom(1);
  }, [current.url]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) setCurrent(files[idx - 1]);
      if (e.key === "ArrowRight" && hasNext) setCurrent(files[idx + 1]);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, hasPrev, hasNext, idx, files]);

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/95">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/60 flex-shrink-0 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-white/50 flex-shrink-0" />
          <span className="text-sm text-white/90 font-medium truncate max-w-[180px] sm:max-w-xs">
            {current.name}
          </span>
          {files.length > 1 && (
            <span className="text-xs text-white/40 flex-shrink-0">
              {idx + 1}/{files.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {isImage && (
            <>
              <button
                onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Alejar"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-white/40 w-9 text-center tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}
                className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Acercar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              {zoom !== 1 && (
                <button
                  onClick={() => setZoom(1)}
                  className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Restablecer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </>
          )}

          <a
            href={current.url}
            download={current.name}
            className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Descargar"
          >
            <Download className="w-4 h-4" />
          </a>

          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div
        className="flex-1 overflow-auto flex items-center justify-center relative"
        onClick={onClose}
      >
        {/* Prev/Next navigation */}
        {hasPrev && (
          <button
            onClick={(e) => { e.stopPropagation(); setCurrent(files[idx - 1]); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {hasNext && (
          <button
            onClick={(e) => { e.stopPropagation(); setCurrent(files[idx + 1]); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Image */}
        {isImage && (
          <div
            className="p-4 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={current.url}
              alt={current.name}
              className="max-w-full object-contain rounded-lg shadow-2xl select-none"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "center",
                transition: "transform 0.15s ease",
              }}
              draggable={false}
            />
          </div>
        )}

        {/* PDF */}
        {isPdf && (
          <div
            className="w-full h-full bg-white rounded-t-lg overflow-hidden"
            style={{ maxWidth: 900 }}
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={current.url}
              title={current.name}
              className="w-full h-full"
              style={{ minHeight: "calc(100vh - 60px)" }}
            />
          </div>
        )}

        {/* Other file types */}
        {!isImage && !isPdf && (
          <div
            className="flex flex-col items-center gap-5 text-white px-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-24 h-24 bg-white/10 rounded-3xl flex items-center justify-center">
              <FileText className="w-12 h-12 text-white/50" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold text-lg">{current.name}</p>
              <p className="text-white/40 text-sm mt-1">
                Vista previa no disponible para este tipo de archivo
              </p>
            </div>
            <a
              href={current.url}
              download={current.name}
              className="flex items-center gap-2 px-6 py-3 bg-white text-[#1e3a5f] rounded-xl font-semibold hover:bg-white/90 transition-colors shadow-lg"
            >
              <Download className="w-4 h-4" />
              Descargar archivo
            </a>
          </div>
        )}
      </div>

      {/* Thumbnails strip (when multiple files) */}
      {files.length > 1 && (
        <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-black/60 border-t border-white/10 overflow-x-auto">
          {files.map((f, i) => (
            <button
              key={f.url}
              onClick={() => setCurrent(f)}
              className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-colors ${
                i === idx ? "border-white" : "border-transparent opacity-50 hover:opacity-80"
              }`}
            >
              {isImageFile(f.type, f.name) ? (
                <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white/60" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
