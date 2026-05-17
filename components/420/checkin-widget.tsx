"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";

const QUICK_TAGS = [
  { id: "relajado",   emoji: "🌊" },
  { id: "hype",       emoji: "🔥" },
  { id: "creativo",   emoji: "🎨" },
  { id: "profundo",   emoji: "🧠" },
  { id: "eufórico",   emoji: "✨" },
  { id: "risas",      emoji: "😂" },
  { id: "hambre",     emoji: "🍕" },
  { id: "somnoliento",emoji: "😴" },
  { id: "ansioso",    emoji: "😰" },
  { id: "inspirado",  emoji: "💡" },
];

const INTENSITY_LABELS: Record<number, string> = {
  1: "Casi nada", 2: "Muy suave", 3: "Suave", 4: "Leve",
  5: "Medio", 6: "Notable", 7: "Intenso", 8: "Muy intenso",
  9: "Pico", 10: "Máximo",
};

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  minutesMark: number;
  color: string;
  onSaved: () => void;
}

export function CheckinWidget({ open, onClose, sessionId, minutesMark, color, onSaved }: Props) {
  const [intensity, setIntensity] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function toggleTag(tag: string) {
    setSelectedTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/420/sessions/${sessionId}/checkins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutesMark, intensity, tags: selectedTags }),
      });
      setIntensity(5);
      setSelectedTags([]);
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  // Intensity color gradient: green → amber → red
  const intColor = intensity <= 3 ? "#4ade80" : intensity <= 6 ? color : intensity <= 8 ? "#fbbf24" : "#f87171";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 380 }}
            className="fixed bottom-0 left-0 right-0 z-[61] rounded-t-3xl"
            style={{ background: "#0d1117" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div className="px-5 pb-8">
              {/* Header */}
              <div className="flex items-center gap-2 mb-5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: `${color}20` }}
                >
                  <Zap className="w-4 h-4" style={{ color }} />
                </div>
                <div>
                  <p className="text-white font-bold text-base">Check-in</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Minuto {minutesMark} de tu sesión
                  </p>
                </div>
              </div>

              {/* Intensity */}
              <div className="mb-5">
                <div className="flex items-end justify-between mb-2">
                  <p className="text-sm font-semibold text-white">¿Cómo estás ahora?</p>
                  <div className="text-right">
                    <span className="text-2xl font-black" style={{ color: intColor }}>{intensity}</span>
                    <span className="text-white/40 text-sm">/10</span>
                  </div>
                </div>
                <div
                  className="text-center text-xs mb-3 py-1 px-3 rounded-full inline-block"
                  style={{ background: `${intColor}20`, color: intColor }}
                >
                  {INTENSITY_LABELS[intensity]}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg">😴</span>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={intensity}
                    onChange={(e) => setIntensity(Number(e.target.value))}
                    className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: intColor }}
                  />
                  <span className="text-lg">🔥</span>
                </div>
              </div>

              {/* Tags */}
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
                ¿Cómo te sientes?
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className="px-3 py-1.5 rounded-full text-sm transition-all"
                    style={{
                      background: selectedTags.includes(tag.id) ? `${color}25` : "rgba(255,255,255,0.06)",
                      color: selectedTags.includes(tag.id) ? color : "rgba(255,255,255,0.5)",
                      border: `1px solid ${selectedTags.includes(tag.id) ? color : "transparent"}`,
                    }}
                  >
                    {tag.emoji} {tag.id}
                  </button>
                ))}
              </div>

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 disabled:opacity-50"
                style={{ background: color, color: "#020a06", boxShadow: `0 0 20px ${color}35` }}
              >
                {saving ? "Guardando..." : "Marcar momento ✓"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
