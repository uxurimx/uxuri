"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Leaf } from "lucide-react";
import { useRouter } from "next/navigation";

const TYPES = [
  { id: "sativa",      emoji: "🌿", label: "Sativa",      desc: "Energía, foco" },
  { id: "indica",      emoji: "🌑", label: "Indica",      desc: "Relax, sueño" },
  { id: "hybrid",      emoji: "⚡", label: "Hybrid",      desc: "Balance" },
  { id: "cbd",         emoji: "🌸", label: "CBD",         desc: "Sin efecto" },
  { id: "hash",        emoji: "🪨", label: "Hash",        desc: "Clásico" },
  { id: "concentrate", emoji: "💎", label: "Concentrate", desc: "Potente" },
];

const METHODS = [
  { id: "joint",   emoji: "🚬", label: "Joint" },
  { id: "pipe",    emoji: "🪨", label: "Pipe" },
  { id: "vape",    emoji: "💨", label: "Vape" },
  { id: "edible",  emoji: "🍪", label: "Edible" },
  { id: "bong",    emoji: "🫧", label: "Bong" },
  { id: "dab",     emoji: "💧", label: "Dab" },
];

const AMOUNTS = [
  { id: "micro",     label: "Micro",  desc: "1 hit" },
  { id: "low",       label: "Poco",   desc: "Suave" },
  { id: "medium",    label: "Medio",  desc: "Normal" },
  { id: "heavy",     label: "Fuerte", desc: "Bastante" },
  { id: "very_heavy",label: "Máx",   desc: "Al tope" },
];

const MOOD_EMOJIS = ["😴", "😑", "😐", "🙂", "😊", "😄", "🤩", "🚀", "🌟", "🔥"];

interface Props {
  open: boolean;
  onClose: () => void;
  color: string;
}

export function SessionStartModal({ open, onClose, color }: Props) {
  const router = useRouter();
  const [type, setType] = useState("sativa");
  const [method, setMethod] = useState("joint");
  const [amount, setAmount] = useState("medium");
  const [strain, setStrain] = useState("");
  const [mood, setMood] = useState(5);
  const [loading, setLoading] = useState(false);

  async function handleStart() {
    setLoading(true);
    try {
      const res = await fetch("/api/420/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, method, amount, strain: strain || null, moodBefore: mood }),
      });
      const session = await res.json();
      router.push(`/420/session/${session.id}`);
    } finally {
      setLoading(false);
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
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 340 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
            style={{ background: "#0d1f15", maxHeight: "92dvh", overflowY: "auto" }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div className="px-5 pb-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Leaf className="w-5 h-5" style={{ color }} />
                  <h2 className="text-white font-bold text-lg">Nueva sesión</h2>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  <X className="w-4 h-4 text-white/60" />
                </button>
              </div>

              {/* Type */}
              <label className="block text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                Tipo
              </label>
              <div className="grid grid-cols-3 gap-2 mb-6">
                {TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setType(t.id)}
                    className="flex flex-col items-center gap-1 py-3 px-2 rounded-2xl border transition-all"
                    style={{
                      borderColor: type === t.id ? color : "rgba(255,255,255,0.08)",
                      background: type === t.id ? `${color}18` : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <span className="text-xl">{t.emoji}</span>
                    <span className="text-white text-xs font-semibold">{t.label}</span>
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{t.desc}</span>
                  </button>
                ))}
              </div>

              {/* Method */}
              <label className="block text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                Método
              </label>
              <div className="grid grid-cols-3 gap-2 mb-6">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id)}
                    className="flex items-center gap-2 py-2.5 px-3 rounded-xl border transition-all"
                    style={{
                      borderColor: method === m.id ? color : "rgba(255,255,255,0.08)",
                      background: method === m.id ? `${color}18` : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <span className="text-base">{m.emoji}</span>
                    <span className="text-white text-sm font-medium">{m.label}</span>
                  </button>
                ))}
              </div>

              {/* Amount */}
              <label className="block text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                Cantidad
              </label>
              <div className="flex gap-2 mb-6">
                {AMOUNTS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAmount(a.id)}
                    className="flex-1 flex flex-col items-center py-2.5 rounded-xl border transition-all"
                    style={{
                      borderColor: amount === a.id ? color : "rgba(255,255,255,0.08)",
                      background: amount === a.id ? `${color}18` : "rgba(255,255,255,0.04)",
                    }}
                  >
                    <span className="text-white text-xs font-bold">{a.label}</span>
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{a.desc}</span>
                  </button>
                ))}
              </div>

              {/* Strain */}
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                Cepa / nombre <span style={{ color: "rgba(255,255,255,0.2)" }}>(opcional)</span>
              </label>
              <input
                type="text"
                value={strain}
                onChange={(e) => setStrain(e.target.value)}
                placeholder="Ej. OG Kush, Amnesia..."
                className="w-full py-3 px-4 rounded-xl text-white placeholder-white/25 outline-none mb-6 text-sm"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
              />

              {/* Mood before */}
              <label className="block text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
                Estado de ánimo ahora — {MOOD_EMOJIS[mood - 1]} {mood}/10
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={mood}
                onChange={(e) => setMood(Number(e.target.value))}
                className="w-full mb-8 accent-current"
                style={{ accentColor: color }}
              />

              {/* Start button */}
              <button
                onClick={handleStart}
                disabled={loading}
                className="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 disabled:opacity-60"
                style={{
                  background: color,
                  color: "#020a06",
                  boxShadow: `0 0 30px ${color}40`,
                }}
              >
                {loading ? "Iniciando..." : "🌿 Encender sesión"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
