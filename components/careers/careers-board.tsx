"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ExternalLink, Copy, Star, ChevronDown, Pencil,
  Eye, Users, Mail, Phone, Calendar, Video, X,
} from "lucide-react";
import Link from "next/link";
import type { JobPosting, JobQuestion, JobApplication } from "@/db/schema";

const STAGES = [
  { key: "new",         label: "Nuevos",        color: "bg-slate-100 text-slate-600" },
  { key: "reviewing",   label: "Revisando",     color: "bg-blue-50 text-blue-700" },
  { key: "shortlisted", label: "Preseleccionados", color: "bg-purple-50 text-purple-700" },
  { key: "interview",   label: "Entrevista",    color: "bg-amber-50 text-amber-700" },
  { key: "hired",       label: "Contratados",   color: "bg-emerald-50 text-emerald-700" },
  { key: "rejected",    label: "Rechazados",    color: "bg-red-50 text-red-600" },
] as const;

type StageKey = typeof STAGES[number]["key"];

const STATUS_MOVE_OPTIONS: StageKey[] = ["new", "reviewing", "shortlisted", "interview", "hired", "rejected"];

type Answer = { questionId: string; value: string | string[] };

export function CareersBoard({
  job,
  questions,
  applications: initialApplications,
}: {
  job: JobPosting;
  questions: JobQuestion[];
  applications: JobApplication[];
}) {
  const router = useRouter();
  const [applications, setApplications] = useState(initialApplications);
  const [jobStatus, setJobStatus] = useState(job.status);
  const [selected, setSelected] = useState<JobApplication | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  async function handleJobStatus(status: string) {
    setJobStatus(status as typeof job.status);
    await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  const grouped = STAGES.reduce<Record<string, JobApplication[]>>((acc, s) => {
    acc[s.key] = applications.filter(a => a.status === s.key);
    return acc;
  }, {} as Record<string, JobApplication[]>);

  async function moveApplication(appId: string, newStatus: StageKey) {
    setApplications(prev =>
      prev.map(a => a.id === appId ? { ...a, status: newStatus } : a)
    );
    if (selected?.id === appId) setSelected(prev => prev ? { ...prev, status: newStatus } : null);
    setMovingId(null);

    await fetch(`/api/jobs/${job.id}/applications/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
  }

  async function setScore(appId: string, score: number) {
    const current = applications.find(a => a.id === appId)?.score;
    const newScore = current === score ? null : score;
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, score: newScore } : a));
    if (selected?.id === appId) setSelected(prev => prev ? { ...prev, score: newScore } : null);

    await fetch(`/api/jobs/${job.id}/applications/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score: newScore }),
    });
  }

  async function saveNotes(appId: string, notes: string) {
    setApplications(prev => prev.map(a => a.id === appId ? { ...a, notes } : a));
    if (selected?.id === appId) setSelected(prev => prev ? { ...prev, notes } : null);

    await fetch(`/api/jobs/${job.id}/applications/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
  }

  function copyJobLink() {
    navigator.clipboard.writeText(`${window.location.origin}/jobs/${job.slug}`);
  }

  const stageCfg = STAGES.find(s => s.key === (job.status as string)) ?? STAGES[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.push("/careers")}
            className="mt-1 p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-[var(--skin-text,#0f172a)]">{job.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-[var(--skin-text-muted,#64748b)]">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> {job.viewCount} vistas
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> {applications.length} aplicaciones
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Status selector */}
          <div className="relative">
            <select
              value={jobStatus}
              onChange={e => handleJobStatus(e.target.value)}
              className={`appearance-none pl-3 pr-7 py-2 rounded-xl text-sm font-semibold border focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] cursor-pointer ${
                jobStatus === "open"   ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                jobStatus === "paused" ? "bg-amber-50 text-amber-700 border-amber-200" :
                jobStatus === "closed" ? "bg-red-50 text-red-600 border-red-200" :
                "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              <option value="draft">Borrador</option>
              <option value="open">Abierta</option>
              <option value="paused">Pausada</option>
              <option value="closed">Cerrada</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
          </div>
          <Link
            href={`/careers/${job.id}/edit`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-xl transition-colors"
          >
            <Pencil className="w-4 h-4" /> Editar
          </Link>
          <button
            onClick={copyJobLink}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-xl transition-colors"
          >
            <Copy className="w-4 h-4" /> Copiar link
          </button>
          <a
            href={`/jobs/${job.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-[#1e3a5f] hover:bg-[#162d4a] px-3 py-2 rounded-xl transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> Ver landing
          </a>
        </div>
      </div>

      {/* Pipeline kanban */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {STAGES.map(stage => (
            <div key={stage.key} className="w-64 shrink-0">
              {/* Column header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${stage.color}`}>
                    {stage.label}
                  </span>
                  <span className="text-xs text-[var(--skin-text-muted,#64748b)] font-medium">
                    {grouped[stage.key].length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="space-y-2">
                {grouped[stage.key].map(app => (
                  <button
                    key={app.id}
                    onClick={() => setSelected(app)}
                    className="w-full text-left bg-[var(--skin-card-bg,#fff)] rounded-xl border border-[var(--skin-border,#e2e8f0)] p-3.5 hover:border-[#1e3a5f]/30 hover:shadow-sm transition-all"
                  >
                    <p className="font-semibold text-sm text-[var(--skin-text,#0f172a)] truncate">{app.name}</p>
                    <p className="text-xs text-[var(--skin-text-muted,#64748b)] truncate mt-0.5">{app.email}</p>

                    <div className="flex items-center justify-between mt-3">
                      {/* Stars */}
                      <div className="flex items-center gap-0.5">
                        {[1,2,3,4,5].map(n => (
                          <Star
                            key={n}
                            className={`w-3.5 h-3.5 ${(app.score ?? 0) >= n ? "fill-amber-400 text-amber-400" : "text-slate-200"}`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-slate-400">
                        {new Date(app.appliedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                      </span>
                    </div>

                    {app.source && (
                      <span className="mt-2 inline-block text-xs bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full border border-slate-100">
                        {app.source}
                      </span>
                    )}
                  </button>
                ))}

                {grouped[stage.key].length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-slate-100 p-4 text-center">
                    <p className="text-xs text-slate-300">Sin candidatos</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <ApplicationPanel
          app={selected}
          questions={questions}
          jobId={job.id}
          onClose={() => setSelected(null)}
          onMove={(status) => moveApplication(selected.id, status)}
          onScore={(score) => setScore(selected.id, score)}
          onSaveNotes={(notes) => saveNotes(selected.id, notes)}
        />
      )}
    </div>
  );
}

// ─── Application detail panel ─────────────────────────────────────────────────

function ApplicationPanel({
  app,
  questions,
  jobId,
  onClose,
  onMove,
  onScore,
  onSaveNotes,
}: {
  app: JobApplication;
  questions: JobQuestion[];
  jobId: string;
  onClose: () => void;
  onMove: (status: StageKey) => void;
  onScore: (score: number) => void;
  onSaveNotes: (notes: string) => void;
}) {
  const [notesVal, setNotesVal] = useState(app.notes ?? "");
  const [notesSaved, setNotesSaved] = useState(true);

  const answers = (app.answers as Answer[]) ?? [];

  function getAnswer(questionId: string): string {
    const ans = answers.find(a => a.questionId === questionId);
    if (!ans) return "";
    if (Array.isArray(ans.value)) return ans.value.join(", ");
    return String(ans.value);
  }

  function handleNotesBlur() {
    if (notesSaved) return;
    onSaveNotes(notesVal);
    setNotesSaved(true);
  }

  const currentStage = STAGES.find(s => s.key === (app.status as string)) ?? STAGES[0];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-xl h-full bg-[var(--skin-card-bg,#fff)] shadow-2xl overflow-y-auto flex flex-col">

        {/* Panel header */}
        <div className="sticky top-0 bg-[var(--skin-card-bg,#fff)] border-b border-[var(--skin-border,#e2e8f0)] px-6 py-4 z-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[var(--skin-text,#0f172a)]">{app.name}</h2>
              <div className="flex items-center gap-3 mt-1 text-sm text-[var(--skin-text-muted,#64748b)]">
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  <a href={`mailto:${app.email}`} className="hover:text-[#1e3a5f]">{app.email}</a>
                </span>
                {app.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> {app.phone}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <div className="flex items-center gap-3 mt-3">
            {/* Status mover */}
            <div className="relative">
              <select
                value={app.status}
                onChange={e => onMove(e.target.value as StageKey)}
                className={`appearance-none pl-3 pr-8 py-1.5 rounded-lg text-xs font-semibold border-0 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] cursor-pointer ${currentStage.color}`}
              >
                {STATUS_MOVE_OPTIONS.map(s => {
                  const cfg = STAGES.find(x => x.key === s)!;
                  return <option key={s} value={s}>{cfg.label}</option>;
                })}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
            </div>

            {/* Score */}
            <div className="flex items-center gap-0.5">
              {[1,2,3,4,5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onScore(n)}
                  className="p-0.5 hover:scale-110 transition-transform"
                >
                  <Star className={`w-4 h-4 ${(app.score ?? 0) >= n ? "fill-amber-400 text-amber-400" : "text-slate-200 hover:text-amber-200"}`} />
                </button>
              ))}
            </div>

            {/* Date */}
            <span className="ml-auto flex items-center gap-1 text-xs text-slate-400">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(app.appliedAt).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}
            </span>
          </div>
        </div>

        {/* Answers */}
        <div className="flex-1 px-6 py-5 space-y-6">
          {questions.map((q, i) => {
            const answer = getAnswer(q.id);
            const isVideo = q.type === "video";
            const isUrl = q.type === "url";
            const isEmpty = !answer;

            return (
              <div key={q.id}>
                <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide mb-1.5">
                  Pregunta {i + 1}
                </p>
                <p className="text-sm font-semibold text-[var(--skin-text,#0f172a)] mb-2">{q.question}</p>

                {isEmpty ? (
                  <p className="text-sm text-slate-300 italic">Sin respuesta</p>
                ) : isVideo ? (
                  <a
                    href={answer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#1e3a5f] hover:underline"
                  >
                    <Video className="w-4 h-4" /> Ver video
                  </a>
                ) : isUrl ? (
                  <a
                    href={answer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-[#1e3a5f] hover:underline break-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" /> {answer}
                  </a>
                ) : (
                  <p className="text-sm text-[var(--skin-text,#0f172a)] leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-xl px-4 py-3">
                    {answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Notes */}
        <div className="sticky bottom-0 bg-[var(--skin-card-bg,#fff)] border-t border-[var(--skin-border,#e2e8f0)] px-6 py-4">
          <label className="block text-xs font-semibold text-[var(--skin-text-muted,#64748b)] mb-2">
            Notas internas
          </label>
          <textarea
            value={notesVal}
            onChange={e => { setNotesVal(e.target.value); setNotesSaved(false); }}
            onBlur={handleNotesBlur}
            rows={3}
            placeholder="Solo visible para ti..."
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-[var(--skin-border,#e2e8f0)] text-[var(--skin-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] transition resize-none"
          />
          {!notesSaved && (
            <p className="text-xs text-slate-400 mt-1">Guardando al perder foco...</p>
          )}
        </div>
      </div>
    </div>
  );
}
