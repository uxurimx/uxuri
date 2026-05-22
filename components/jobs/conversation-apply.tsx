"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Send, Loader2, CheckCircle2,
  MessageSquare, Bot, AlertCircle,
} from "lucide-react";
import type { JobPosting } from "@/db/schema";

type Step = "contact" | "chat" | "success";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function ConversationApply({
  job,
  onBack,
}: {
  job: JobPosting;
  onBack: () => void;
}) {
  const [step, setStep] = useState<Step>("contact");

  // Contact form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Chat state
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [canFinish, setCanFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  function contactValid() {
    return name.trim().length > 0 && /\S+@\S+\.\S+/.test(email);
  }

  async function startConversation() {
    setError(null);
    setSending(true);

    const source = new URLSearchParams(window.location.search).get("source") ?? undefined;

    try {
      const res = await fetch(`/api/jobs/${job.slug}/conversation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          name, email,
          phone: phone || undefined,
          source,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al iniciar la entrevista.");
        return;
      }

      setApplicationId(data.applicationId);
      setMessages([
        {
          id: "intro-user",
          role: "user",
          content: `Hola, soy ${name} y me interesa la posición de ${job.title}.`,
        },
        {
          id: "intro-assistant",
          role: "assistant",
          content: data.message,
        },
      ]);
      setStep("chat");
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || sending || !applicationId) return;
    const text = input.trim();
    setInput("");
    setError(null);

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await fetch(`/api/jobs/${job.slug}/conversation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "message", applicationId, message: text }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al enviar mensaje.");
        return;
      }

      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString() + "-a", role: "assistant", content: data.message },
      ]);

      if (data.canFinish) setCanFinish(true);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  async function finishConversation() {
    if (!applicationId || finishing) return;
    setFinishing(true);

    try {
      await fetch(`/api/jobs/${job.slug}/conversation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "finish", applicationId }),
      });
      setStep("success");
    } catch {
      setFinishing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={step === "contact" ? onBack : () => setStep("contact")}
            disabled={step === "chat" || step === "success"}
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            {step === "contact" ? "Volver a la vacante" : "Entrevista en curso"}
          </button>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#1e3a5f] bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
            <MessageSquare className="w-3.5 h-3.5" />
            Pre-entrevista IA
          </div>
        </div>
        {/* Progress */}
        <div className="h-1 bg-slate-100">
          <motion.div
            className="h-full bg-[#1e3a5f]"
            animate={{
              width: step === "contact" ? "33%" : step === "chat" ? "66%" : "100%",
            }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </nav>

      <AnimatePresence mode="wait">

        {/* ── Step 1: Contacto ────────────────────────────────────────────── */}
        {step === "contact" && (
          <motion.div
            key="contact"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
            className="flex-1 flex items-start justify-center py-16 px-6"
          >
            <div className="w-full max-w-lg space-y-6">
              <div>
                <p className="text-sm font-semibold text-[#1e3a5f] uppercase tracking-widest mb-2">
                  Pre-entrevista con IA
                </p>
                <h2 className="text-3xl font-black text-slate-900 mb-2">
                  Antes de empezar
                </h2>
                <p className="text-slate-500">
                  Tendrás una conversación de ~10 minutos con nuestro agente de IA. Sin formatos, sin scripts. Solo preguntas reales.
                </p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-lg">💬</span>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">Conversación adaptativa</p>
                    <p className="text-slate-500 text-xs">El agente profundiza donde hay respuestas vagas</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-lg">⏱</span>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">~10 minutos</p>
                    <p className="text-slate-500 text-xs">Puedes terminar cuando quieras después de 4 respuestas</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-lg">🎯</span>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">Scorecard automático</p>
                    <p className="text-slate-500 text-xs">La IA genera una evaluación que el equipo revisa</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Nombre completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
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
                    onChange={(e) => setEmail(e.target.value)}
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
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+52 55 0000 0000"
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 text-slate-900 text-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] transition"
                  />
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
                onClick={startConversation}
                disabled={!contactValid() || sending}
                whileHover={contactValid() && !sending ? { scale: 1.02 } : {}}
                whileTap={contactValid() && !sending ? { scale: 0.98 } : {}}
                className="w-full inline-flex items-center justify-center gap-3 bg-[#1e3a5f] text-white px-8 py-4 rounded-2xl font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              >
                {sending ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Iniciando entrevista...</>
                ) : (
                  <>Comenzar entrevista <ArrowRight className="w-5 h-5" /></>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── Step 2: Chat ─────────────────────────────────────────────────── */}
        {step === "chat" && (
          <motion.div
            key="chat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            {/* Chat header */}
            <div className="bg-slate-900 text-white px-6 py-4">
              <div className="max-w-2xl mx-auto flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#1e3a5f] border-2 border-blue-400 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{job.title}</p>
                  <p className="text-xs text-slate-400">Entrevistador IA · En línea</p>
                </div>
                {canFinish && (
                  <motion.button
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={finishConversation}
                    disabled={finishing}
                    className="ml-auto inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
                  >
                    {finishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Terminar entrevista
                  </motion.button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto py-6 px-6">
              <div className="max-w-2xl mx-auto space-y-4">
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center mr-2 shrink-0 mt-1">
                        <Bot className="w-4 h-4 text-slate-300" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-[#1e3a5f] text-white rounded-br-sm"
                          : "bg-slate-100 text-slate-800 rounded-bl-sm"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </motion.div>
                ))}

                {/* Typing indicator */}
                {sending && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                  >
                    <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center mr-2 shrink-0">
                      <Bot className="w-4 h-4 text-slate-300" />
                    </div>
                    <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 rounded-full bg-slate-400"
                          animate={{ y: [0, -4, 0] }}
                          transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {error && (
              <div className="max-w-2xl mx-auto px-6 pb-2 w-full">
                <div className="flex items-start gap-2 text-red-600 bg-red-50 px-4 py-2.5 rounded-xl border border-red-100 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="border-t border-slate-200 bg-white px-6 py-4">
              <div className="max-w-2xl mx-auto flex items-end gap-3">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu respuesta... (Enter para enviar)"
                  rows={2}
                  disabled={sending}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] transition resize-none disabled:opacity-60"
                />
                <motion.button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  whileHover={!input.trim() || sending ? {} : { scale: 1.05 }}
                  whileTap={!input.trim() || sending ? {} : { scale: 0.95 }}
                  className="w-11 h-11 rounded-xl bg-[#1e3a5f] text-white flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity"
                >
                  {sending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </motion.button>
              </div>
              <p className="max-w-2xl mx-auto mt-2 text-xs text-slate-400">
                Shift+Enter para nueva línea · Enter para enviar
                {canFinish && " · Puedes terminar la entrevista cuando quieras"}
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Success ──────────────────────────────────────────────────────── */}
        {step === "success" && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex-1 flex items-center justify-center px-6 py-16"
          >
            <div className="text-center max-w-lg">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
                className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-50 mb-8"
              >
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              </motion.div>
              <h2 className="text-4xl font-black text-slate-900 mb-4">
                Entrevista completada.
              </h2>
              <p className="text-lg text-slate-500 mb-2">
                Gracias por tu tiempo, <strong>{name}</strong>.
              </p>
              <p className="text-xl font-bold text-[#1e3a5f] mb-6">
                {job.title}
              </p>
              <p className="text-slate-400 text-sm max-w-sm mx-auto leading-relaxed">
                Nuestro equipo revisará la conversación y el scorecard generado. Si hay fit, te contactamos directamente.
              </p>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
