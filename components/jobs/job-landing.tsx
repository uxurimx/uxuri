"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, CheckCircle2, Check,
  MapPin, Clock, DollarSign, ChevronRight, Loader2, Zap, MessageSquare,
} from "lucide-react";
import type { JobPosting, JobQuestion } from "@/db/schema";
import { ChallengeApply } from "./challenge-apply";
import { ConversationApply } from "./conversation-apply";

// ─── Types ────────────────────────────────────────────────────────────────────

type View = "landing" | "form" | "challenge" | "conversation" | "success";

interface FormData {
  name: string;
  email: string;
  phone: string;
  answers: Record<string, string | string[]>;
}

const EMPLOYMENT_LABELS: Record<string, string> = {
  fixed_salary: "Sueldo fijo",
  commission: "Por resultados / Comisión",
  mixed: "Esquema mixto",
  equity_partner: "Socio / Equity",
};

// ─── Main component ───────────────────────────────────────────────────────────

export function JobLanding({
  job,
  questions,
}: {
  job: JobPosting;
  questions: JobQuestion[];
}) {
  const [view, setView] = useState<View>("landing");
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({
    name: "", email: "", phone: "", answers: {},
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Track view once on mount
  useEffect(() => {
    fetch(`/api/jobs/${job.slug}/view`, { method: "POST" }).catch(() => {});
  }, [job.slug]);

  const isClosed = job.status !== "open";
  const isChallenge = job.applicationType === "challenge";
  const isConversation = job.applicationType === "conversation";
  const totalSteps = questions.length + 1;

  function scrollTop() {
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function startForm() {
    if (isChallenge) setView("challenge");
    else if (isConversation) setView("conversation");
    else setView("form");
    setStep(0);
    setTimeout(scrollTop, 50);
  }

  function goBack() {
    if (step === 0) {
      setView("landing");
    } else {
      setStep((s) => s - 1);
    }
    setTimeout(scrollTop, 50);
  }

  function goNext() {
    setStep((s) => s + 1);
    setTimeout(scrollTop, 50);
  }

  function setAnswer(questionId: string, value: string | string[]) {
    setFormData((prev) => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: value },
    }));
  }

  function toggleMulti(questionId: string, option: string) {
    const current = (formData.answers[questionId] as string[]) ?? [];
    const updated = current.includes(option)
      ? current.filter((v) => v !== option)
      : [...current, option];
    setAnswer(questionId, updated);
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);

    const payload = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone || undefined,
      answers: questions.map((q) => ({
        questionId: q.id,
        value: formData.answers[q.id] ?? "",
      })),
      source: new URLSearchParams(window.location.search).get("source") ?? undefined,
    };

    try {
      const res = await fetch(`/api/jobs/${job.slug}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Hubo un error al enviar tu aplicación.");
        return;
      }

      setView("success");
      setTimeout(scrollTop, 50);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  function canProceed(): boolean {
    if (step === 0) {
      return formData.name.trim().length > 0 && /\S+@\S+\.\S+/.test(formData.email);
    }
    const q = questions[step - 1];
    if (!q.isRequired) return true;
    const val = formData.answers[q.id];
    if (!val) return false;
    if (Array.isArray(val)) return val.length > 0;
    return val.trim().length > 0;
  }

  const isLastStep = step === totalSteps - 1;

  return (
    <div ref={topRef} className="min-h-screen bg-white">
      <AnimatePresence mode="wait">

        {/* ─── LANDING VIEW ─────────────────────────────────────────────── */}
        {view === "landing" && (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {/* Minimal nav */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-white/5">
              <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                <span className="text-white font-bold text-lg tracking-tight">
                  Uxuri
                </span>
                {!isClosed && (
                  <button
                    onClick={startForm}
                    className="text-sm font-semibold text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors"
                  >
                    Aplicar →
                  </button>
                )}
              </div>
            </nav>

            {/* Hero */}
            <section className="bg-slate-900 pt-32 pb-20 px-6">
              <div className="max-w-4xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="flex flex-wrap gap-3 mb-6">
                    {isChallenge && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        <Zap className="w-3 h-3" />
                        Reto · {job.challengeDeadlineHours ?? 48}h para completar
                      </span>
                    )}
                    {isConversation && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                        <MessageSquare className="w-3 h-3" />
                        Pre-entrevista IA · ~10 min
                      </span>
                    )}
                    {job.employmentType && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/20">
                        <DollarSign className="w-3 h-3" />
                        {EMPLOYMENT_LABELS[job.employmentType]}
                      </span>
                    )}
                    {job.closesAt && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/20">
                        <Clock className="w-3 h-3" />
                        Cierra {new Date(job.closesAt).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                      <MapPin className="w-3 h-3" />
                      Remoto
                    </span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-tight mb-6">
                    {job.title}
                  </h1>

                  {job.tagline && (
                    <p className="text-xl text-slate-300 max-w-2xl leading-relaxed">
                      {job.tagline}
                    </p>
                  )}

                  {!isClosed && (
                    <motion.button
                      onClick={startForm}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="mt-10 inline-flex items-center gap-3 bg-white text-slate-900 px-8 py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-slate-100 transition-colors"
                    >
                      {isChallenge ? "Acepta el reto" : isConversation ? "Comenzar entrevista" : "Quiero aplicar"}
                      <ArrowRight className="w-5 h-5" />
                    </motion.button>
                  )}

                  {isClosed && (
                    <div className="mt-10 inline-flex items-center gap-2 text-slate-400 border border-slate-700 px-6 py-3 rounded-xl">
                      Esta vacante ya no está disponible
                    </div>
                  )}
                </motion.div>
              </div>
            </section>

            {/* Description body */}
            {job.description && (
              <section className="py-16 px-6">
                <div className="max-w-4xl mx-auto">
                  <div className="prose prose-slate max-w-none">
                    {job.description.split("\n").map((line, i) => {
                      const trimmed = line.trim();
                      if (!trimmed) return <div key={i} className="h-4" />;
                      if (trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("✓")) {
                        return (
                          <div key={i} className="flex items-start gap-3 my-2">
                            <Check className="w-5 h-5 text-[#1e3a5f] mt-0.5 shrink-0" />
                            <span className="text-slate-700 text-lg leading-relaxed">
                              {trimmed.replace(/^[•\-✓]\s*/, "")}
                            </span>
                          </div>
                        );
                      }
                      if (trimmed === trimmed.toUpperCase() && trimmed.length > 3) {
                        return (
                          <h2 key={i} className="text-2xl font-bold text-slate-900 mt-10 mb-4">
                            {trimmed}
                          </h2>
                        );
                      }
                      return (
                        <p key={i} className="text-slate-700 text-lg leading-relaxed my-2">
                          {trimmed}
                        </p>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* Requirements */}
            {job.requirements && (
              <section className="py-16 px-6 bg-slate-50">
                <div className="max-w-4xl mx-auto">
                  <h2 className="text-2xl font-bold text-slate-900 mb-8">Si has logrado esto, quiero conocerte:</h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {job.requirements.split("\n").filter(l => l.trim()).map((line, i) => (
                      <div key={i} className="flex items-start gap-3 bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-slate-700 font-medium leading-snug">
                          {line.trim().replace(/^[✓•\-]\s*/, "")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Bottom CTA */}
            {!isClosed && (
              <section className="py-20 px-6 bg-[#1e3a5f]">
                <div className="max-w-4xl mx-auto text-center">
                  <h2 className="text-3xl font-black text-white mb-4">
                    ¿Eres la persona correcta?
                  </h2>
                  <p className="text-slate-300 text-lg mb-8 max-w-xl mx-auto">
                    No necesito títulos ni currículums bonitos. Necesito evidencia. Si tienes resultados reales, demostralo.
                  </p>
                  <motion.button
                    onClick={startForm}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="inline-flex items-center gap-3 bg-white text-[#1e3a5f] px-10 py-5 rounded-2xl font-black text-xl shadow-2xl hover:bg-slate-100 transition-colors"
                  >
                    {isChallenge ? "Acepta el reto ahora" : isConversation ? "Comenzar entrevista" : "Aplicar ahora"}
                    <ArrowRight className="w-6 h-6" />
                  </motion.button>
                </div>
              </section>
            )}
          </motion.div>
        )}

        {/* ─── CHALLENGE VIEW ───────────────────────────────────────────── */}
        {view === "challenge" && (
          <motion.div
            key="challenge"
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.3 }}
          >
            <ChallengeApply
              job={job}
              onBack={() => { setView("landing"); setTimeout(scrollTop, 50); }}
            />
          </motion.div>
        )}

        {/* ─── CONVERSATION VIEW ────────────────────────────────────────── */}
        {view === "conversation" && (
          <motion.div
            key="conversation"
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col min-h-screen"
          >
            <ConversationApply
              job={job}
              onBack={() => { setView("landing"); setTimeout(scrollTop, 50); }}
            />
          </motion.div>
        )}

        {/* ─── FORM VIEW ────────────────────────────────────────────────── */}
        {view === "form" && (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.3 }}
            className="min-h-screen flex flex-col"
          >
            {/* Form nav */}
            <nav className="sticky top-0 z-50 bg-white border-b border-slate-200">
              <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
                <button
                  onClick={goBack}
                  className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 text-sm font-medium transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {step === 0 ? "Volver a la vacante" : "Anterior"}
                </button>
                <span className="text-sm text-slate-400 font-medium">
                  Paso {step + 1} de {totalSteps}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1 bg-slate-100">
                <motion.div
                  className="h-full bg-[#1e3a5f]"
                  initial={{ width: 0 }}
                  animate={{ width: `${((step + 1) / totalSteps) * 100}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </nav>

            {/* Step content */}
            <div className="flex-1 flex items-start justify-center py-16 px-6">
              <div className="w-full max-w-2xl">
                <AnimatePresence mode="wait">
                  {step === 0 ? (
                    <StepBasicInfo
                      key="basic"
                      data={formData}
                      onChange={(field, val) =>
                        setFormData((prev) => ({ ...prev, [field]: val }))
                      }
                    />
                  ) : (
                    <StepQuestion
                      key={questions[step - 1].id}
                      question={questions[step - 1]}
                      value={formData.answers[questions[step - 1].id]}
                      onChange={(val) => setAnswer(questions[step - 1].id, val)}
                      onToggleMulti={(opt) => toggleMulti(questions[step - 1].id, opt)}
                      stepNumber={step}
                      totalSteps={totalSteps}
                    />
                  )}
                </AnimatePresence>

                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-4 text-red-600 text-sm font-medium bg-red-50 px-4 py-3 rounded-xl border border-red-100"
                  >
                    {error}
                  </motion.p>
                )}

                <div className="mt-8 flex justify-end">
                  {isLastStep ? (
                    <motion.button
                      onClick={handleSubmit}
                      disabled={!canProceed() || submitting}
                      whileHover={canProceed() && !submitting ? { scale: 1.02 } : {}}
                      whileTap={canProceed() && !submitting ? { scale: 0.98 } : {}}
                      className="inline-flex items-center gap-3 bg-[#1e3a5f] text-white px-8 py-4 rounded-2xl font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          Enviar aplicación
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </motion.button>
                  ) : (
                    <motion.button
                      onClick={goNext}
                      disabled={!canProceed()}
                      whileHover={canProceed() ? { scale: 1.02 } : {}}
                      whileTap={canProceed() ? { scale: 0.98 } : {}}
                      className="inline-flex items-center gap-3 bg-[#1e3a5f] text-white px-8 py-4 rounded-2xl font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    >
                      Continuar
                      <ChevronRight className="w-5 h-5" />
                    </motion.button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── SUCCESS VIEW ─────────────────────────────────────────────── */}
        {view === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="min-h-screen flex items-center justify-center px-6"
          >
            <div className="text-center max-w-lg">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-50 mb-8"
              >
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              </motion.div>
              <h1 className="text-4xl font-black text-slate-900 mb-4">
                ¡Aplicación enviada!
              </h1>
              <p className="text-lg text-slate-500 leading-relaxed mb-2">
                Recibimos tu información para la posición de
              </p>
              <p className="text-xl font-bold text-[#1e3a5f] mb-8">
                {job.title}
              </p>
              <p className="text-slate-400 text-sm">
                Si hay fit, te contactaremos directamente.
              </p>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

// ─── Step components ──────────────────────────────────────────────────────────

function StepBasicInfo({
  data,
  onChange,
}: {
  data: FormData;
  onChange: (field: "name" | "email" | "phone", val: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25 }}
    >
      <p className="text-sm font-semibold text-[#1e3a5f] uppercase tracking-widest mb-2">
        Datos de contacto
      </p>
      <h2 className="text-3xl font-black text-slate-900 mb-8">
        ¿Cómo te contactamos?
      </h2>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Nombre completo <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={data.name}
            onChange={(e) => onChange("name", e.target.value)}
            placeholder="Tu nombre"
            className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 text-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent transition"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Correo electrónico <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={data.email}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="tu@email.com"
            className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 text-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent transition"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            WhatsApp / Teléfono
            <span className="ml-2 text-slate-400 font-normal text-xs">(opcional)</span>
          </label>
          <input
            type="tel"
            value={data.phone}
            onChange={(e) => onChange("phone", e.target.value)}
            placeholder="+52 55 0000 0000"
            className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 text-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent transition"
          />
        </div>
      </div>
    </motion.div>
  );
}

function StepQuestion({
  question,
  value,
  onChange,
  onToggleMulti,
  stepNumber,
  totalSteps,
}: {
  question: JobQuestion;
  value: string | string[] | undefined;
  onChange: (val: string | string[]) => void;
  onToggleMulti: (opt: string) => void;
  stepNumber: number;
  totalSteps: number;
}) {
  const strVal = (value as string) ?? "";
  const arrVal = (value as string[]) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.25 }}
    >
      <p className="text-sm font-semibold text-[#1e3a5f] uppercase tracking-widest mb-2">
        Pregunta {stepNumber} de {totalSteps - 1}
      </p>
      <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-3 leading-tight">
        {question.question}
        {!question.isRequired && (
          <span className="ml-2 text-base font-normal text-slate-400">(opcional)</span>
        )}
      </h2>
      {question.hint && (
        <p className="text-slate-500 mb-6 text-base leading-relaxed">
          {question.hint}
        </p>
      )}

      {/* text */}
      {question.type === "text" && (
        <input
          type="text"
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder ?? "Tu respuesta..."}
          className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 text-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent transition"
          autoFocus
        />
      )}

      {/* textarea */}
      {question.type === "textarea" && (
        <textarea
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder ?? "Escribe tu respuesta aquí..."}
          rows={6}
          className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 text-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent transition resize-none"
          autoFocus
        />
      )}

      {/* url */}
      {question.type === "url" && (
        <input
          type="url"
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder ?? "https://..."}
          className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 text-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent transition"
          autoFocus
        />
      )}

      {/* video */}
      {question.type === "video" && (
        <div className="space-y-3">
          <input
            type="url"
            value={strVal}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://loom.com/share/... o https://youtu.be/..."
            className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 text-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent transition"
            autoFocus
          />
          <p className="text-sm text-slate-400">
            Graba un video de máx. 3 minutos en Loom, YouTube o Google Drive y pega el enlace aquí.
          </p>
        </div>
      )}

      {/* select */}
      {question.type === "select" && (
        <div className="space-y-3">
          {(question.options ?? []).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`w-full text-left px-5 py-4 rounded-xl border-2 font-medium text-base transition-all ${
                strVal === opt
                  ? "border-[#1e3a5f] bg-blue-50 text-[#1e3a5f]"
                  : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* multiselect */}
      {question.type === "multiselect" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400 mb-2">Selecciona todas las que apliquen</p>
          {(question.options ?? []).map((opt) => {
            const checked = arrVal.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onToggleMulti(opt)}
                className={`w-full text-left px-5 py-4 rounded-xl border-2 font-medium text-base transition-all flex items-center gap-3 ${
                  checked
                    ? "border-[#1e3a5f] bg-blue-50 text-[#1e3a5f]"
                    : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                  checked ? "bg-[#1e3a5f] border-[#1e3a5f]" : "border-slate-300"
                }`}>
                  {checked && <Check className="w-3 h-3 text-white" />}
                </div>
                {opt}
              </button>
            );
          })}
        </div>
      )}

      {/* choice (A/B) */}
      {question.type === "choice" && (
        <div className="grid sm:grid-cols-2 gap-4 mt-2">
          {(question.options ?? []).map((opt, i) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`px-6 py-8 rounded-2xl border-2 font-bold text-lg transition-all flex flex-col items-center gap-2 ${
                strVal === opt
                  ? "border-[#1e3a5f] bg-[#1e3a5f] text-white shadow-lg"
                  : "border-slate-200 text-slate-700 hover:border-[#1e3a5f]/40 hover:bg-slate-50"
              }`}
            >
              <span className="text-3xl font-black opacity-60">
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
