"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, X, RefreshCw, Send, Loader2 } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-react";

interface CameraCaptureProps {
  onSend: (file: { url: string; name: string; type: string; size: number }) => Promise<void>;
  disabled?: boolean;
}

type State = "idle" | "open" | "captured" | "uploading";

export function CameraCapture({ onSend, disabled }: CameraCaptureProps) {
  const [state, setState] = useState<State>("idle");
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { startUpload } = useUploadThing("chatFile", {
    onClientUploadComplete: async (files) => {
      if (!files[0] || !capturedBlob) return;
      await onSend({
        url: files[0].ufsUrl,
        name: files[0].name,
        type: "image/jpeg",
        size: capturedBlob.size,
      });
      close();
    },
    onUploadError: () => {
      alert("Error al subir la foto.");
      setState("captured");
    },
  });

  function close() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedUrl(null);
    setCapturedBlob(null);
    setCamError(null);
    setState("idle");
  }

  async function openCamera() {
    setState("open");
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      setCamError("No se pudo acceder a la cámara. Verifica los permisos.");
    }
  }

  function capture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      setCapturedBlob(blob);
      setCapturedUrl(URL.createObjectURL(blob));
      setState("captured");
      streamRef.current?.getTracks().forEach((t) => t.stop());
    }, "image/jpeg", 0.9);
  }

  async function send() {
    if (!capturedBlob) return;
    setState("uploading");
    const file = new File([capturedBlob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
    await startUpload([file]);
  }

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()); }, []);

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={openCamera}
        disabled={disabled}
        title="Tomar foto"
        className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#1e3a5f] hover:bg-slate-100 transition-colors disabled:opacity-40"
      >
        <Camera className="w-4 h-4" />
      </button>

      {/* Modal */}
      {state !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="font-semibold text-slate-800 text-sm">
                {state === "open" ? "Tomar foto" : state === "captured" ? "Vista previa" : "Enviando..."}
              </span>
              <button onClick={close} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="relative bg-black aspect-[4/3] flex items-center justify-center">
              {camError ? (
                <p className="text-white text-sm text-center px-6">{camError}</p>
              ) : state === "open" ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                capturedUrl && (
                  <img src={capturedUrl} alt="Captura" className="w-full h-full object-cover" />
                )
              )}
              {state === "uploading" && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-center gap-4 px-4 py-4">
              {state === "open" && !camError && (
                <button
                  onClick={capture}
                  className="w-14 h-14 rounded-full bg-white border-4 border-[#1e3a5f] hover:bg-slate-50 transition-colors flex items-center justify-center"
                  title="Capturar"
                >
                  <div className="w-10 h-10 rounded-full bg-[#1e3a5f]" />
                </button>
              )}
              {state === "captured" && (
                <>
                  <button
                    onClick={openCamera}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reintentar
                  </button>
                  <button
                    onClick={send}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1e3a5f] text-white text-sm hover:bg-[#162d4a] transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    Enviar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
