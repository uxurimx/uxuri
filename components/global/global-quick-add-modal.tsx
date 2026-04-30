"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  X, CheckSquare, StickyNote, FolderOpen, Target, Search,
  CheckCircle, Loader2, ArrowDownLeft, ArrowUpRight, Wallet, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGlobalQuickAdd, type QuickAddTab } from "./global-quick-add-provider";
import type { SearchResult } from "@/app/api/search/route";

// ── Tab config ──────────────────────────────────────────────────────────────

const TABS: { id: QuickAddTab; label: string; Icon: typeof CheckSquare }[] = [
  { id: "task",      label: "Tarea",    Icon: CheckSquare },
  { id: "note",      label: "Nota",     Icon: StickyNote  },
  { id: "project",   label: "Proyecto", Icon: FolderOpen  },
  { id: "objective", label: "Objetivo", Icon: Target      },
  { id: "payment",   label: "Pago",     Icon: Wallet      },
  { id: "search",    label: "Buscar",   Icon: Search      },
];

// ── Status labels ────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  todo: "Por hacer", in_progress: "En progreso", review: "Revisión", done: "Hecho",
  planning: "Planificación", active: "Activo", paused: "Pausado",
  completed: "Completado", cancelled: "Cancelado", draft: "Borrador",
};

const TYPE_LABELS: Record<string, string> = {
  task: "Tarea", project: "Proyecto", note: "Nota", objective: "Objetivo",
};

const TYPE_ICONS: Record<string, typeof CheckSquare> = {
  task: CheckSquare, project: FolderOpen, note: StickyNote, objective: Target,
};

// ── Component ────────────────────────────────────────────────────────────────

export function GlobalQuickAddModal() {
  const router = useRouter();
  const { isOpen, activeTab, prefill, close, setTab } = useGlobalQuickAdd();

  // Create form state
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [noteContent, setNoteContent] = useState("");
  const [projectStatus, setProjectStatus] = useState("planning");
  const [horizon, setHorizon] = useState("");

  // Task extras
  const [taskDescription, setTaskDescription] = useState("");
  const [taskProjectId, setTaskProjectId] = useState("");
  const [showTaskAdvanced, setShowTaskAdvanced] = useState(false);
  const [taskProjects, setTaskProjects] = useState<{ id: string; name: string }[]>([]);

  // Project extras
  const [projectDescription, setProjectDescription] = useState("");
  const [showProjectAdvanced, setShowProjectAdvanced] = useState(false);

  // Payment form state
  const [payAmount, setPayAmount] = useState("");
  const [payType, setPayType] = useState<"income" | "expense">("expense");
  const [payDesc, setPayDesc] = useState("");
  const [payAccountId, setPayAccountId] = useState("");
  const [accounts, setAccounts] = useState<{ id: string; name: string; icon: string | null }[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Refs for autofocus
  const titleRef = useRef<HTMLInputElement>(null);
  const taskDescRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Reset all form state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setPriority("medium");
      setNoteContent("");
      setProjectStatus("planning");
      setHorizon("");
      setSearchQuery("");
      setSearchResults([]);
      setSuccess(null);
      setPayAmount("");
      setPayType("expense");
      setPayDesc("");
      setTaskDescription("");
      setTaskProjectId("");
      setShowTaskAdvanced(false);
      setProjectDescription("");
      setShowProjectAdvanced(false);
    }
  }, [isOpen]);

  // Load projects when task tab is active
  useEffect(() => {
    if (activeTab !== "task" || taskProjects.length > 0) return;
    fetch("/api/projects")
      .then((r) => r.ok ? r.json() : [])
      .then((data: { id: string; name: string }[]) => setTaskProjects(data));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Load accounts when payment tab is active
  useEffect(() => {
    if (activeTab !== "payment" || accounts.length > 0) return;
    fetch("/api/accounts")
      .then((r) => r.ok ? r.json() : [])
      .then((data: { id: string; name: string; icon: string | null }[]) => {
        setAccounts(data);
        if (data.length > 0) setPayAccountId(data[0].id);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Apply prefill when modal opens
  useEffect(() => {
    if (isOpen && prefill) setTitle(prefill);
  }, [isOpen, prefill]);

  // Autofocus correct input when tab changes or modal opens
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (activeTab === "search") searchRef.current?.focus();
      else if (activeTab === "task") taskDescRef.current?.focus();
      else titleRef.current?.focus();
    }, 60);
    return () => clearTimeout(timer);
  }, [isOpen, activeTab]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, close]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) setSearchResults(await res.json());
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => {
      setSuccess(null);
      close();
      router.refresh();
    }, 900);
  }

  async function handleCreate() {
    if (loading) return;
    setLoading(true);
    try {
      if (activeTab === "task") {
        const t = title.trim();
        if (!t) return;
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: t,
            priority,
            status: "todo",
            projectId: taskProjectId || null,
            description: taskDescription.trim() || null,
          }),
        });
        if (res.ok) showSuccess(`Tarea "${t}" creada`);

      } else if (activeTab === "note") {
        const t = title.trim();
        if (!t) return;
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: t, content: noteContent }),
        });
        if (res.ok) showSuccess(`Nota "${t}" creada`);

      } else if (activeTab === "project") {
        const n = title.trim();
        if (!n) return;
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: n,
            status: projectStatus,
            description: projectDescription.trim() || undefined,
          }),
        });
        if (res.ok) showSuccess(`Proyecto "${n}" creado`);

      } else if (activeTab === "objective") {
        const t = title.trim();
        if (!t) return;
        const res = await fetch("/api/objectives", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: t, status: "active", horizon: horizon || undefined }),
        });
        if (res.ok) showSuccess(`Objetivo "${t}" creado`);

      } else if (activeTab === "payment") {
        const amount = parseFloat(payAmount.replace(",", "."));
        const desc = payDesc.trim();
        if (!amount || amount <= 0 || !desc || !payAccountId) return;
        const today = new Date().toISOString().slice(0, 10);
        const res = await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: payAccountId,
            type: payType,
            amount,
            description: desc,
            date: today,
            status: "completed",
          }),
        });
        if (res.ok) showSuccess(payType === "income" ? `Ingreso de $${amount} registrado` : `Gasto de $${amount} registrado`);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[140]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={close} />

      {/* Modal: bottom sheet on mobile, centered card on desktop */}
      <div className="absolute inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center md:p-4">
        <div className="relative bg-white md:rounded-2xl md:border md:border-slate-200 md:shadow-2xl w-full md:max-w-[520px] rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] md:max-h-[85vh]">

          {/* Drag handle — mobile only */}
          <div className="flex justify-center pt-3 pb-1 md:hidden flex-shrink-0">
            <div className="w-10 h-1 bg-slate-200 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-3 md:pt-4 pb-0 flex-shrink-0">
            <span className="text-xs text-slate-400 font-mono hidden md:block">Ctrl+K</span>
            <span className="text-sm font-semibold text-slate-700 md:hidden">Crear nuevo</span>
            <button onClick={close} className="text-slate-400 hover:text-slate-600 transition-colors p-1 -mr-1">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex px-4 pt-3 pb-0 border-b border-slate-100 flex-shrink-0 overflow-x-auto scrollbar-none gap-0.5">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex flex-col md:flex-row items-center gap-1 md:gap-1.5 px-3 py-2 text-xs md:text-sm rounded-t-lg transition-colors -mb-px border-b-2 flex-1 md:flex-none shrink-0 whitespace-nowrap",
                  activeTab === id
                    ? "text-[#1e3a5f] border-[#1e3a5f] font-semibold bg-slate-50"
                    : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50"
                )}
              >
                <Icon className="w-4 h-4 md:w-3.5 md:h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Body — scrollable */}
          <div className="p-5 overflow-y-auto flex-1">
            {/* ── Success state ── */}
            {success && (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center">
                  <CheckCircle className="w-7 h-7 text-teal-600" />
                </div>
                <p className="text-sm text-slate-700 font-medium text-center">{success}</p>
              </div>
            )}

            {/* ── Search tab ── */}
            {!success && activeTab === "search" && (
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    ref={searchRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar tareas, proyectos, notas, objetivos..."
                    className="w-full pl-9 pr-3 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                  />
                </div>

                <div className="mt-3 min-h-[120px]">
                  {searching && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                    </div>
                  )}

                  {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      Sin resultados para &quot;{searchQuery}&quot;
                    </div>
                  )}

                  {!searching && searchQuery.length < 2 && (
                    <p className="text-center py-8 text-slate-400 text-sm">
                      Escribe al menos 2 caracteres para buscar
                    </p>
                  )}

                  {!searching && searchResults.length > 0 && (
                    <div className="space-y-1">
                      {searchResults.map((r) => {
                        const Icon = TYPE_ICONS[r.type] ?? Search;
                        return (
                          <a
                            key={`${r.type}-${r.id}`}
                            href={r.url}
                            onClick={close}
                            className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors group"
                          >
                            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-200 transition-colors">
                              <Icon className="w-4 h-4 text-slate-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-800 font-medium truncate">{r.title}</p>
                              <p className="text-xs text-slate-400">{TYPE_LABELS[r.type]}</p>
                            </div>
                            {r.status && (
                              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">
                                {STATUS_LABELS[r.status] ?? r.status}
                              </span>
                            )}
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Tarea form ── */}
            {!success && activeTab === "task" && (
              <div className="space-y-3">
                <input
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Título de la tarea"
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                />
                <textarea
                  ref={taskDescRef}
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="¿Qué necesitas hacer? Agrega contexto..."
                  rows={3}
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 resize-none"
                />
                <select
                  value={taskProjectId}
                  onChange={(e) => setTaskProjectId(e.target.value)}
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                >
                  <option value="">📥 Bandeja de entrada</option>
                  {taskProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setShowTaskAdvanced((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", showTaskAdvanced && "rotate-180")} />
                  Opciones avanzadas
                </button>

                {showTaskAdvanced && (
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-3 border border-slate-200 rounded-xl text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                  >
                    <option value="low">Prioridad: Baja</option>
                    <option value="medium">Prioridad: Media</option>
                    <option value="high">Prioridad: Alta</option>
                    <option value="urgent">Prioridad: Urgente</option>
                  </select>
                )}

                <SubmitButton label="Crear tarea" loading={loading} disabled={!title.trim()} onClick={handleCreate} />
              </div>
            )}

            {/* ── Nota form ── */}
            {!success && activeTab === "note" && (
              <div className="space-y-3">
                <input
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Título de la nota"
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                />
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Contenido (opcional)..."
                  rows={4}
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 resize-none"
                />
                <SubmitButton label="Crear nota" loading={loading} disabled={!title.trim()} onClick={handleCreate} />
              </div>
            )}

            {/* ── Proyecto form ── */}
            {!success && activeTab === "project" && (
              <div className="space-y-3">
                <input
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Nombre del proyecto"
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                />
                <textarea
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Descripción del proyecto (opcional)"
                  rows={3}
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 resize-none"
                />

                <button
                  type="button"
                  onClick={() => setShowProjectAdvanced((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", showProjectAdvanced && "rotate-180")} />
                  Opciones avanzadas
                </button>

                {showProjectAdvanced && (
                  <select
                    value={projectStatus}
                    onChange={(e) => setProjectStatus(e.target.value)}
                    className="w-full px-3 py-3 border border-slate-200 rounded-xl text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                  >
                    <option value="planning">Estado: Planificación</option>
                    <option value="active">Estado: Activo</option>
                    <option value="paused">Estado: Pausado</option>
                    <option value="completed">Estado: Completado</option>
                    <option value="cancelled">Estado: Cancelado</option>
                  </select>
                )}

                <SubmitButton label="Crear proyecto" loading={loading} disabled={!title.trim()} onClick={handleCreate} />
              </div>
            )}

            {/* ── Objetivo form ── */}
            {!success && activeTab === "objective" && (
              <div className="space-y-3">
                <input
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Título del objetivo"
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                />
                <select
                  value={horizon}
                  onChange={(e) => setHorizon(e.target.value)}
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                >
                  <option value="">Horizonte: Sin definir</option>
                  <option value="daily">Diario</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="yearly">Anual</option>
                  <option value="life">De vida</option>
                </select>
                <SubmitButton label="Crear objetivo" loading={loading} disabled={!title.trim()} onClick={handleCreate} />
              </div>
            )}

            {/* ── Pago form ── */}
            {!success && activeTab === "payment" && (
              <div className="space-y-3">
                {/* Tipo entrada/salida */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPayType("income")}
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-colors",
                      payType === "income"
                        ? "bg-emerald-50 border-emerald-400 text-emerald-700"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    Entrada
                  </button>
                  <button
                    onClick={() => setPayType("expense")}
                    className={cn(
                      "flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-colors",
                      payType === "expense"
                        ? "bg-rose-50 border-rose-400 text-rose-700"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    Salida
                  </button>
                </div>

                {/* Monto */}
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
                  <input
                    ref={titleRef}
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-3 border border-slate-200 rounded-xl text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                  />
                </div>

                {/* Descripción */}
                <input
                  value={payDesc}
                  onChange={(e) => setPayDesc(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Descripción breve"
                  maxLength={200}
                  className="w-full px-3 py-3 border border-slate-200 rounded-xl text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                />

                {/* Cuenta */}
                {accounts.length > 0 ? (
                  <select
                    value={payAccountId}
                    onChange={(e) => setPayAccountId(e.target.value)}
                    className="w-full px-3 py-3 border border-slate-200 rounded-xl text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.icon ? `${a.icon} ` : ""}{a.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-1">
                    Cargando cuentas…
                  </p>
                )}

                <SubmitButton
                  label={payType === "income" ? "Registrar entrada" : "Registrar salida"}
                  loading={loading}
                  disabled={!payAmount || parseFloat(payAmount) <= 0 || !payDesc.trim() || !payAccountId}
                  onClick={handleCreate}
                />
              </div>
            )}
          </div>

          {/* Footer hint — desktop only */}
          {!success && (
            <div className="hidden md:flex px-5 pb-4 items-center justify-between text-xs text-slate-400 flex-shrink-0">
              <span>Esc para cerrar</span>
              <span>Ctrl+K para abrir/cerrar</span>
            </div>
          )}

          {/* Safe area padding — mobile only */}
          <div className="md:hidden h-safe-bottom pb-2 flex-shrink-0" />
        </div>
      </div>
    </div>
  );
}

// ── Submit button helper ─────────────────────────────────────────────────────

function SubmitButton({
  label,
  loading,
  disabled,
  onClick,
}: {
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="w-full py-2.5 bg-[#1e3a5f] text-white rounded-xl text-sm font-medium hover:bg-[#162d4a] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {label}
    </button>
  );
}
