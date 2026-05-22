"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, Clock, Link2, FileText,
  Loader2, CheckCircle2, AlertCircle,
} from "lucide-react";
import type { JobPosting } from "@/db/schema";

type Step = "contact" | "mission" | "success";

export function ChallengeApply({
  job,
  onBack,
}: {
  job: JobPosting;
  onBack: () => void;
}) {
  const [step, setStep] = useState<Step>("contact");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submissionUrl, setSubmissionUrl] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");

  const deadlineHours = job.challengeDeadlineHours ?? 48;

  function canContinue() {
    return name.trim().length > 0 && /\S+@\S+\.\S+/.test(email);
  }

  function canSubmit() {
    return submissionUrl.trim().length > 0 && submissionNotes.trim().length >= 10;
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);

    const source = new URLSearchParams(window.location.search).get("source") ?? undefined;

    try {
      const res = await fetch(`/api/jobs/${job.slug}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email,
          phone: phone || undefined,
          submissionUrl,
          submissionNotes,
          source,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al enviar. Intenta de nuevo.");
        return;
      }

      setStep("success");
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={step === "contact" ? onBack : () => setStep("contact")}
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {step === "contact" ? "Volver a la vacante" : "Anterior"}
          </button>
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
            <Clock className="w-3.5 h-3.5" />
            {deadlineHours}h para completar
          </div>
        </div>
        {/* Progress */}
        <div className="h-1 bg-slate-100">
          <motion.div
            className="h-full bg-[#1e3a5f]"
            animate={{ width: step === "contact" ? "50%" : "100%" }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </nav>

      <div className="flex-1 flex items-start justify-center py-16 px-6">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">

            {/* ── Step 1: Contacto ──────────────────────────────────────── */}
            {step === "contact" && (
              <motion.div
                key="contact"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div>
                  <p className="text-sm font-semibold text-[#1e3a5f] uppercase tracking-widest mb-2">
                    Paso 1 de 2
                  </p>
                  <h2 className="text-3xl font-black text-slate-900 mb-2">
                    ¿Quién acepta el reto?
                  </h2>
                  <p className="text-slate-500">
                    Tienes <strong>{deadlineHours} horas</strong> para completarlo desde que lo aceptes.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Nombre completo <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Tu nombre"
                      autoFocus
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 text-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 text-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      WhatsApp
                      <span className="ml-2 text-slate-400 font-normal text-xs">(opcional)</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+52 55 0000 0000"
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 text-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] transition"
                    />
                  </div>
                </div>

                <motion.button
                  onClick={() => setStep("mission")}
                  disabled={!canContinue()}
                  whileHover={canContinue() ? { scale: 1.02 } : {}}
                  whileTap={canContinue() ? { scale: 0.98 } : {}}
                  className="w-full inline-flex items-center justify-center gap-3 bg-[#1e3a5f] text-white px-8 py-4 rounded-2xl font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  Acepto el reto
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </motion.div>
            )}

            {/* ── Step 2: Misión + submit ────────────────────────────────── */}
            {step === "mission" && (
              <motion.div
                key="mission"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                <div>
                  <p className="text-sm font-semibold text-[#1e3a5f] uppercase tracking-widest mb-2">
                    Paso 2 de 2
                  </p>
                  <h2 className="text-3xl font-black text-slate-900 mb-1">
                    Tu misión
                  </h2>
                  <p className="text-slate-500 text-sm">
                    Lee el brief, ejecuta, y envía tu evidencia.
                  </p>
                </div>

                {/* Brief card — estilo mission briefing */}
                {job.challengeBrief ? (
                  <div className="bg-slate-900 rounded-2xl p-6 border border-slate-700">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                        Mission Brief
                      </span>
                      <span className="ml-auto text-xs text-slate-500 font-mono">
                        ⏱ {deadlineHours}h
                      </span>
                    </div>
                    <p className="text-slate-100 leading-relaxed whitespace-pre-wrap font-mono text-sm">
                      {job.challengeBrief}
                    </p>
                  </div>
                ) : (
                  <div className="bg-slate-900 rounded-2xl p-6 border border-slate-700">
                    <p className="text-slate-400 text-sm italic">Brief no especificado.</p>
                  </div>
                )}

                {/* Submission */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      <Link2 className="w-4 h-4 inline mr-1.5 text-[#1e3a5f]" />
                      Enlace a tu evidencia <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      value={submissionUrl}
                      onChange={e => setSubmissionUrl(e.target.value)}
                      placeholder="https://docs.google.com/... · Notion · Drive · Loom · etc."
                      autoFocus
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] transition"
                    />
                    <p className="text-xs text-slate-400 mt-1.5">
                      Puede ser un doc, una hoja de cálculo, un video, capturas de pantalla, un repositorio — lo que demuestre tu trabajo.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      <FileText className="w-4 h-4 inline mr-1.5 text-[#1e3a5f]" />
                      ¿Qué hiciste exactamente? <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={submissionNotes}
                      onChange={e => setSubmissionNotes(e.target.value)}
                      rows={5}
                      placeholder={"Describe concretamente:\n• Qué acciones tomaste\n• Qué resultados obtuviste (con números si aplica)\n• Qué aprendiste o qué harías diferente"}
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] transition resize-none"
                    />
                    <p className="text-xs text-slate-400 mt-1.5">
                      Sé específico. Esta descripción es lo que más peso tiene en la evaluación.
                    </p>
                  </div>
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-start gap-3 text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-100 text-sm"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {error}
                  </motion.div>
                )}

                <motion.button
                  onClick={handleSubmit}
                  disabled={!canSubmit() || submitting}
                  whileHover={canSubmit() && !submitting ? { scale: 1.02 } : {}}
                  whileTap={canSubmit() && !submitting ? { scale: 0.98 } : {}}
                  className="w-full inline-flex items-center justify-center gap-3 bg-[#1e3a5f] text-white px-8 py-4 rounded-2xl font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  {submitting ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Enviando evidencia...</>
                  ) : (
                    <><ArrowRight className="w-5 h-5" /> Enviar evidencia</>
                  )}
                </motion.button>
              </motion.div>
            )}

            {/* ── Success ────────────────────────────────────────────────── */}
            {step === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="text-center py-12"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
                  className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-50 mb-8"
                >
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                </motion.div>
                <h2 className="text-4xl font-black text-slate-900 mb-4">
                  Reto enviado.
                </h2>
                <p className="text-lg text-slate-500 mb-2">
                  Recibimos tu evidencia para
                </p>
                <p className="text-xl font-bold text-[#1e3a5f] mb-8">
                  {job.title}
                </p>
                <p className="text-slate-400 text-sm max-w-sm mx-auto">
                  Revisaremos tu entrega. Si hay fit, te contactamos directamente.
                </p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
