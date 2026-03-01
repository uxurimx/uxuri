"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Send, X } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing-react";

interface VoiceRecorderProps {
  onSend: (file: { url: string; name: string; type: string; size: number }) => Promise<void>;
  disabled?: boolean;
}

type State = "idle" | "recording" | "recorded" | "uploading";

function formatSecs(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export function VoiceRecorder({ onSend, disabled }: VoiceRecorderProps) {
  const [state, setState] = useState<State>("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { startUpload } = useUploadThing("voiceNote", {
    onClientUploadComplete: async (files) => {
      if (!files[0] || !audioBlob) return;
      await onSend({
        url: files[0].ufsUrl,
        name: files[0].name,
        type: audioBlob.type || "audio/webm",
        size: audioBlob.size,
      });
      reset();
    },
    onUploadError: () => {
      alert("Error al subir la nota de voz.");
      setState("recorded");
    },
  });

  function reset() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    streamRef.current = null;
    setSeconds(0);
    setAudioUrl(null);
    setAudioBlob(null);
    setState("idle");
  }

  useEffect(() => () => { reset(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setState("recorded");
        stream.getTracks().forEach((t) => t.stop());
      };

      mr.start(200);
      setState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      alert("No se pudo acceder al micrófono. Verifica los permisos.");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  }

  async function send() {
    if (!audioBlob) return;
    setState("uploading");
    const ext = audioBlob.type.includes("mp4") ? "mp4" : "webm";
    const file = new File([audioBlob], `voice-note-${Date.now()}.${ext}`, { type: audioBlob.type });
    await startUpload([file]);
  }

  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={startRecording}
        disabled={disabled}
        title="Nota de voz"
        className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:text-[#1e3a5f] hover:bg-slate-100 transition-colors disabled:opacity-40"
      >
        <Mic className="w-4 h-4" />
      </button>
    );
  }

  if (state === "recording") {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          {formatSecs(seconds)}
        </span>
        <button
          type="button"
          onClick={stopRecording}
          title="Detener"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
        >
          <Square className="w-4 h-4 fill-red-500" />
        </button>
        <button
          type="button"
          onClick={reset}
          title="Cancelar"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (state === "recorded") {
    return (
      <div className="flex items-center gap-2">
        <audio src={audioUrl ?? undefined} controls className="h-8 max-w-[160px]" />
        <button
          type="button"
          onClick={send}
          title="Enviar nota de voz"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#1e3a5f] text-white hover:bg-[#162d4a] transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={reset}
          title="Descartar"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // uploading
  return (
    <div className="flex items-center gap-2 text-xs text-blue-600">
      <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
      Enviando nota...
    </div>
  );
}
