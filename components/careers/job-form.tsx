"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, GripVertical, ArrowLeft, Loader2, ChevronDown } from "lucide-react";

const QUESTION_TYPES = [
  { value: "textarea",    label: "Texto largo" },
  { value: "text",        label: "Texto corto" },
  { value: "url",         label: "Enlace / URL" },
  { value: "video",       label: "Video (Loom/YouTube)" },
  { value: "multiselect", label: "Selección múltiple" },
  { value: "select",      label: "Selección única" },
  { value: "choice",      label: "Elección A/B" },
];

const HEAD_OF_GROWTH_TEMPLATE = [
  { question: "¿Cuál es el proyecto que más has ayudado a crecer?", type: "textarea", isRequired: true, hint: "Incluye: nombre del proyecto, qué vendía, qué hiciste exactamente y los resultados con números reales.", options: [] },
  { question: "¿Qué métricas mejoraste exactamente?", type: "multiselect", isRequired: true, hint: "", options: ["Leads","Ventas","Conversión","Ticket promedio","Retención","ROI"] },
  { question: "Si mañana te entrego una agencia de IA y automatización con pocos clientes, ¿cuáles serían las primeras 10 acciones que realizarías durante los próximos 30 días?", type: "textarea", isRequired: true, hint: "Aquí verás quién piensa estratégicamente.", options: [] },
  { question: "¿Qué herramientas utilizas actualmente?", type: "multiselect", isRequired: true, hint: "", options: ["Meta Ads","Google Ads","HubSpot","GoHighLevel","Notion","Airtable","CRM propio","Make / n8n","IA","Email Marketing"] },
  { question: "Comparte 3 campañas que hayas ejecutado personalmente", type: "textarea", isRequired: true, hint: "Con enlaces si es posible.", options: [] },
  { question: "¿Qué libros, creadores o referentes influyen más en tu forma de crecer negocios?", type: "textarea", isRequired: true, hint: "Aquí se detecta curiosidad intelectual.", options: [] },
  { question: "¿Cuál fue tu fracaso más grande intentando crecer un negocio y qué aprendiste?", type: "textarea", isRequired: true, hint: "Excelente detector de madurez.", options: [] },
  { question: "¿Qué harías si tu presupuesto de marketing fuera $0 durante los próximos 30 días?", type: "textarea", isRequired: true, hint: "Esta pregunta es oro para startups.", options: [] },
  { question: "¿Qué prefieres?", type: "choice", isRequired: true, hint: "Los buenos growth suelen elegir experimentar.", options: ["Tener razón","Probar hipótesis"] },
  { question: "Graba un video de máximo 3 minutos explicando cómo harías crecer mi negocio", type: "video", isRequired: true, hint: "Aquí eliminas al 80% de los candidatos.", options: [] },
  { question: "¿Qué esquema de compensación prefieres?", type: "choice", isRequired: false, hint: "", options: ["Sueldo fijo","Esquema mixto (base + comisión)","Porcentaje sobre resultados"] },
];

type Question = {
  question: string;
  type: string;
  isRequired: boolean;
  hint: string;
  options: string[];
};

function toSlug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s-]/g,"").trim().replace(/\s+/g,"-").slice(0,180);
}

type JobData = {
  id: string; title: string; slug: string; tagline: string | null;
  description: string | null; requirements: string | null;
  employmentType: string | null; status: string; isPublic: boolean;
  businessId: string | null;
};

export function JobForm({
  businesses,
  job,
  questions: initialQuestions,
}: {
  businesses: { id: string; name: string; logo: string | null }[];
  job?: JobData;
  questions?: Question[];
}) {
  const router = useRouter();
  const isEdit = !!job;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(job?.title ?? "");
  const [slug, setSlug] = useState(job?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(isEdit);
  const [tagline, setTagline] = useState(job?.tagline ?? "");
  const [description, setDescription] = useState(job?.description ?? "");
  const [requirements, setRequirements] = useState(job?.requirements ?? "");
  const [employmentType, setEmploymentType] = useState(job?.employmentType ?? "commission");
  const [status, setStatus] = useState(job?.status ?? "draft");
  const [isPublic, setIsPublic] = useState(job?.isPublic ?? true);
  const [businessId, setBusinessId] = useState(job?.businessId ?? "");
  const [questions, setQuestions] = useState<Question[]>(initialQuestions ?? []);
  const [newOption, setNewOption] = useState<Record<number, string>>({});

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!slugEdited) setSlug(toSlug(val));
  }

  function loadTemplate() {
    if (questions.length > 0 && !confirm("¿Reemplazar las preguntas actuales con la plantilla Head of Growth?")) return;
    setQuestions(HEAD_OF_GROWTH_TEMPLATE.map(q => ({ ...q })));
  }

  function addQuestion() {
    setQuestions(prev => [...prev, { question: "", type: "textarea", isRequired: true, hint: "", options: [] }]);
  }

  function removeQuestion(i: number) {
    setQuestions(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateQuestion(i: number, field: keyof Question, value: unknown) {
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q));
  }

  function addOption(i: number) {
    const opt = (newOption[i] ?? "").trim();
    if (!opt) return;
    updateQuestion(i, "options", [...questions[i].options, opt]);
    setNewOption(prev => ({ ...prev, [i]: "" }));
  }

  function removeOption(qi: number, oi: number) {
    updateQuestion(qi, "options", questions[qi].options.filter((_, idx) => idx !== oi));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("El título es requerido."); return; }
    if (!slug.trim()) { setError("El slug es requerido."); return; }
    setError(null);
    setSubmitting(true);

    const payload = {
      title, slug, tagline, description, requirements,
      employmentType, status, isPublic,
      businessId: businessId || undefined,
      questions: questions.map((q, i) => ({ ...q, sortOrder: i })),
    };

    const res = isEdit
      ? await fetch(`/api/jobs/${job!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error?.formErrors?.[0] ?? `Error al ${isEdit ? "guardar" : "crear"} la vacante.`);
      setSubmitting(false);
      return;
    }

    const saved = await res.json();
    router.push(`/careers/${isEdit ? job!.id : saved.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => router.push("/careers")}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--skin-text,#0f172a)]">{isEdit ? "Editar vacante" : "Nueva vacante"}</h1>
          <p className="text-sm text-[var(--skin-text-muted,#64748b)]">{isEdit ? "Actualiza el contenido y las preguntas" : "Crea un posting y comparte el link en tus redes"}</p>
        </div>
      </div>

      {/* Info básica */}
      <section className="bg-[var(--skin-card-bg,#fff)] rounded-2xl border border-[var(--skin-border,#e2e8f0)] p-6 space-y-5">
        <h2 className="font-bold text-[var(--skin-text,#0f172a)]">Información básica</h2>

        <div>
          <label className="block text-sm font-semibold text-[var(--skin-text-muted,#64748b)] mb-1.5">
            Título de la posición *
          </label>
          <input
            type="text"
            value={title}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="Ej: Head of Growth, Desarrollador Fullstack..."
            className="w-full px-4 py-3 rounded-xl border border-[var(--skin-border,#e2e8f0)] text-[var(--skin-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] transition"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--skin-text-muted,#64748b)] mb-1.5">
            Slug (URL pública)
          </label>
          <div className="flex items-center rounded-xl border border-[var(--skin-border,#e2e8f0)] overflow-hidden focus-within:ring-2 focus-within:ring-[#1e3a5f]">
            <span className="pl-4 pr-2 text-sm text-slate-400 shrink-0">/jobs/</span>
            <input
              type="text"
              value={slug}
              onChange={e => { setSlug(e.target.value); setSlugEdited(true); }}
              className="flex-1 py-3 pr-4 text-[var(--skin-text,#0f172a)] focus:outline-none bg-transparent"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-semibold text-[var(--skin-text-muted,#64748b)] mb-1.5">
              Tipo de compensación
            </label>
            <select
              value={employmentType}
              onChange={e => setEmploymentType(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[var(--skin-border,#e2e8f0)] text-[var(--skin-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] transition"
            >
              <option value="commission">Por resultados / Comisión</option>
              <option value="fixed_salary">Sueldo fijo</option>
              <option value="mixed">Esquema mixto</option>
              <option value="equity_partner">Socio / Equity</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--skin-text-muted,#64748b)] mb-1.5">
              Estado inicial
            </label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[var(--skin-border,#e2e8f0)] text-[var(--skin-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] transition"
            >
              <option value="draft">Borrador (invisible)</option>
              <option value="open">Publicar ahora</option>
            </select>
          </div>
        </div>

        {businesses.length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-[var(--skin-text-muted,#64748b)] mb-1.5">
              Negocio que contrata
              <span className="ml-2 text-slate-400 font-normal text-xs">(opcional)</span>
            </label>
            <select
              value={businessId}
              onChange={e => setBusinessId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[var(--skin-border,#e2e8f0)] text-[var(--skin-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] transition"
            >
              <option value="">— Sin asociar —</option>
              {businesses.map(b => (
                <option key={b.id} value={b.id}>{b.logo} {b.name}</option>
              ))}
            </select>
          </div>
        )}
      </section>

      {/* Copy */}
      <section className="bg-[var(--skin-card-bg,#fff)] rounded-2xl border border-[var(--skin-border,#e2e8f0)] p-6 space-y-5">
        <h2 className="font-bold text-[var(--skin-text,#0f172a)]">Copy de la vacante</h2>
        <p className="text-sm text-[var(--skin-text-muted,#64748b)] -mt-2">
          Este es el texto que verán los candidatos. Puedes usar • para listas y MAYÚSCULAS para títulos de sección.
        </p>

        <div>
          <label className="block text-sm font-semibold text-[var(--skin-text-muted,#64748b)] mb-1.5">
            Tagline (el gancho, máx. 2 líneas)
          </label>
          <input
            type="text"
            value={tagline}
            onChange={e => setTagline(e.target.value)}
            placeholder="No busco empleados. Busco socios de crecimiento."
            className="w-full px-4 py-3 rounded-xl border border-[var(--skin-border,#e2e8f0)] text-[var(--skin-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] transition"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--skin-text-muted,#64748b)] mb-1.5">
            Descripción completa
          </label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={10}
            placeholder={"No busco un community manager.\nNo busco alguien que publique por publicar.\n\nBusco a la persona que pueda ayudarme a crecer...\n\nTU MISIÓN SERÁ SIMPLE:\n\n• Conseguir clientes.\n• Crear oportunidades de venta."}
            className="w-full px-4 py-3 rounded-xl border border-[var(--skin-border,#e2e8f0)] text-[var(--skin-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] transition resize-none font-mono text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--skin-text-muted,#64748b)] mb-1.5">
            Requisitos / Checklist "Si has logrado..."
            <span className="ml-2 text-slate-400 font-normal text-xs">(una línea por item)</span>
          </label>
          <textarea
            value={requirements}
            onChange={e => setRequirements(e.target.value)}
            rows={5}
            placeholder={"✓ Conseguir clientes para agencias\n✓ Escalar proyectos digitales\n✓ Crear embudos de venta que funcionan"}
            className="w-full px-4 py-3 rounded-xl border border-[var(--skin-border,#e2e8f0)] text-[var(--skin-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] transition resize-none font-mono text-sm"
          />
        </div>
      </section>

      {/* Preguntas */}
      <section className="bg-[var(--skin-card-bg,#fff)] rounded-2xl border border-[var(--skin-border,#e2e8f0)] p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-[var(--skin-text,#0f172a)]">Preguntas del formulario</h2>
            <p className="text-sm text-[var(--skin-text-muted,#64748b)] mt-0.5">
              {questions.length} pregunta{questions.length !== 1 ? "s" : ""} — una por pantalla en el formulario
            </p>
          </div>
          <button
            type="button"
            onClick={loadTemplate}
            className="text-xs font-semibold text-[#1e3a5f] bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors border border-blue-100"
          >
            Usar plantilla Head of Growth
          </button>
        </div>

        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={i} className="rounded-xl border border-[var(--skin-border,#e2e8f0)] p-4 space-y-3">
              <div className="flex items-start gap-3">
                <GripVertical className="w-4 h-4 text-slate-300 mt-3 shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={q.question}
                      onChange={e => updateQuestion(i, "question", e.target.value)}
                      placeholder="Escribe la pregunta..."
                      className="flex-1 px-3 py-2 rounded-lg border border-[var(--skin-border,#e2e8f0)] text-sm text-[var(--skin-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] transition"
                    />
                    <div className="relative">
                      <select
                        value={q.type}
                        onChange={e => updateQuestion(i, "type", e.target.value)}
                        className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-[var(--skin-border,#e2e8f0)] text-sm text-[var(--skin-text,#0f172a)] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] transition"
                      >
                        {QUESTION_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <input
                    type="text"
                    value={q.hint}
                    onChange={e => updateQuestion(i, "hint", e.target.value)}
                    placeholder="Hint o explicación (opcional)"
                    className="w-full px-3 py-2 rounded-lg border border-[var(--skin-border,#e2e8f0)] text-xs text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] transition"
                  />

                  {(q.type === "select" || q.type === "multiselect" || q.type === "choice") && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-500">Opciones:</p>
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <span className="flex-1 text-sm text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg">
                            {opt}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeOption(i, oi)}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newOption[i] ?? ""}
                          onChange={e => setNewOption(prev => ({ ...prev, [i]: e.target.value }))}
                          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addOption(i))}
                          placeholder="Nueva opción..."
                          className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--skin-border,#e2e8f0)] text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] transition"
                        />
                        <button
                          type="button"
                          onClick={() => addOption(i)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-medium transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`req-${i}`}
                      checked={q.isRequired}
                      onChange={e => updateQuestion(i, "isRequired", e.target.checked)}
                      className="w-3.5 h-3.5 accent-[#1e3a5f]"
                    />
                    <label htmlFor={`req-${i}`} className="text-xs text-slate-500">
                      Requerida
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeQuestion(i)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors mt-1 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addQuestion}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-500 hover:border-[#1e3a5f]/40 hover:text-[#1e3a5f] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Agregar pregunta
        </button>
      </section>

      {error && (
        <p className="text-red-600 text-sm font-medium bg-red-50 px-4 py-3 rounded-xl border border-red-100">
          {error}
        </p>
      )}

      {/* Submit */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <button
          type="button"
          onClick={() => router.push("/careers")}
          className="px-5 py-2.5 rounded-xl border border-[var(--skin-border,#e2e8f0)] text-sm font-semibold text-[var(--skin-text-muted,#64748b)] hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 bg-[#1e3a5f] text-white px-6 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-[#162d4a] transition-colors"
        >
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : isEdit ? "Guardar cambios" : "Crear vacante"}
        </button>
      </div>
    </form>
  );
}
