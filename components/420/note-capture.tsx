"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, MicOff, Send, Lightbulb, CheckSquare, FileText } from "lucide-react";

const QUICK_TAGS = ["insight", "idea", "conexión", "visual", "musical", "profundo", "risa", "pregunta"];

const TYPES = [
  { id: "text",    icon: FileText,    label: "Nota" },
  { id: "insight", icon: Lightbulb,  label: "Insight" },
  { id: "task",    icon: CheckSquare, label: "Tarea" },
  { id: "voice",   icon: Mic,         label: "Voz" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  minutesMark: number;
  color: string;
  onSaved: () => void;
}

export function NoteCapture({ open, onClose, sessionId, minutesMark, color, onSaved }: Props) {
  const [noteType, setNoteType] = useState<"text" | "insight" | "task" | "voice">("text");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [saving, setSaving] = useState(false);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setTranscribing(true);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const fd = new FormData();
        fd.append("audio", blob, "recording.webm");
        try {
          const res = await fetch("/api/420/transcribe", { method: "POST", body: fd });
          const data = await res.json();
          if (data.text) setContent((prev) => prev ? prev + " " + data.text : data.text);
        } catch {}
        setTranscribing(false);
      };

      recorder.start();
      setRecording(true);
    } catch (e) {
      console.error("No audio permission", e);
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
  }

  function toggleTag(tag: string) {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  }

  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/420/sessions/${sessionId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          type: noteType === "voice" ? "voice" : noteType,
          tags: tags.length ? tags : undefined,
          minutesMark,
          createTask: noteType === "task",
        }),
      });
      setContent("");
      setTags([]);
      setNoteType("text");
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/50"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 380 }}
            className="fixed bottom-0 left-0 right-0 z-[61] rounded-t-3xl"
            style={{ background: "#0a1a10" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div className="px-4 pb-8">
              {/* Type tabs */}
              <div className="flex gap-2 mb-4">
                {TYPES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setNoteType(t.id as typeof noteType)}
                      className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all"
                      style={{
                        background: noteType === t.id ? `${color}22` : "rgba(255,255,255,0.05)",
                        border: `1px solid ${noteType === t.id ? color : "transparent"}`,
                      }}
                    >
                      <Icon className="w-4 h-4" style={{ color: noteType === t.id ? color : "rgba(255,255,255,0.4)" }} />
                      <span className="text-[10px] font-semibold" style={{ color: noteType === t.id ? color : "rgba(255,255,255,0.4)" }}>
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Text input */}
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  noteType === "insight" ? "¿Qué insight tuviste?" :
                  noteType === "task" ? "¿Qué quieres hacer después?" :
                  "¿Qué está pasando por tu mente?"
                }
                rows={4}
                className="w-full rounded-2xl p-4 text-white placeholder-white/25 outline-none resize-none text-base leading-relaxed mb-3"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
                autoFocus={noteType !== "voice"}
              />

              {/* Voice button */}
              {noteType === "voice" && (
                <button
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 mb-3 font-semibold text-sm transition-all active:scale-95"
                  style={{
                    background: recording ? `${color}30` : "rgba(255,255,255,0.06)",
                    border: `2px solid ${recording ? color : "rgba(255,255,255,0.1)"}`,
                    color: recording ? color : "rgba(255,255,255,0.6)",
                    boxShadow: recording ? `0 0 20px ${color}40` : "none",
                  }}
                >
                  {transcribing ? (
                    <span>Transcribiendo...</span>
                  ) : recording ? (
                    <><MicOff className="w-5 h-5" /> Suelta para parar</>
                  ) : (
                    <><Mic className="w-5 h-5" /> Mantén presionado para grabar</>
                  )}
                </button>
              )}

              {/* Quick tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: tags.includes(tag) ? `${color}25` : "rgba(255,255,255,0.06)",
                      color: tags.includes(tag) ? color : "rgba(255,255,255,0.45)",
                      border: `1px solid ${tags.includes(tag) ? color : "transparent"}`,
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* Save */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-3 rounded-xl text-sm font-medium"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={!content.trim() || saving}
                  className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40"
                  style={{ background: color, color: "#020a06" }}
                >
                  <Send className="w-4 h-4" />
                  {noteType === "task" ? "Guardar + crear tarea" : "Guardar"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
