"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { X, Search, Loader2 } from "lucide-react";
import type { Client } from "@/db/schema";
import { WorkspacePicker } from "@/components/workspaces/workspace-picker";

const schema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
  clientId: z.string().optional(),
  status: z.enum(["planning", "active", "paused", "completed", "cancelled"]),
  priority: z.enum(["low", "medium", "high"]),
  privacy: z.enum(["public", "private"]),
  range: z.enum(["short", "long"]).optional(),
  category: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type UserResult = { id: string; name: string | null; email: string; imageUrl: string | null };
type SharedUser = { id: string; name: string | null; email: string; permission: "view" | "edit" };

export function ProjectForm({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [workspaceId, setWorkspaceId] = useState("");

  // Share-with state
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [sharedWith, setSharedWith] = useState<SharedUser[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: "planning",
      priority: "medium",
      privacy: "public",
      startDate: new Date().toISOString().split("T")[0],
    },
  });

  // Debounced user search
  useEffect(() => {
    if (userSearch.length < 2) { setUserResults([]); setShowUserDropdown(false); return; }
    const t = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(userSearch)}`);
        if (res.ok) {
          const data: UserResult[] = await res.json();
          // Exclude already selected users
          setUserResults(data.filter((u) => !sharedWith.some((s) => s.id === u.id)));
          setShowUserDropdown(true);
        }
      } finally {
        setSearchingUsers(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [userSearch, sharedWith]);

  function addUser(user: UserResult) {
    setSharedWith((prev) => [...prev, { id: user.id, name: user.name, email: user.email, permission: "view" }]);
    setUserSearch("");
    setUserResults([]);
    setShowUserDropdown(false);
  }

  function removeUser(id: string) {
    setSharedWith((prev) => prev.filter((u) => u.id !== id));
  }

  function togglePermission(id: string) {
    setSharedWith((prev) =>
      prev.map((u) => u.id === id ? { ...u, permission: u.permission === "view" ? "edit" : "view" } : u)
    );
  }

  async function onSubmit(data: FormData) {
    setIsLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          clientId: data.clientId || undefined,
          range: data.range || undefined,
          category: data.category || undefined,
          ...(workspaceId ? { workspaceId } : {}),
        }),
      });

      if (res.ok) {
        const project = await res.json();

        // Share with selected users
        if (sharedWith.length > 0) {
          await Promise.all(
            sharedWith.map((u) =>
              fetch("/api/shares", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  resourceType: "project",
                  resourceId: project.id,
                  sharedWithId: u.id,
                  permission: u.permission,
                }),
              })
            )
          );
        }

        router.push(`/projects/${project.id}`);
        router.refresh();
      }
    } finally {
      setIsLoading(false);
    }
  }

  const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20";

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white rounded-xl border border-slate-200 p-6 space-y-5"
    >
      {/* Workspace picker — visible only in global mode */}
      <WorkspacePicker value={workspaceId} onChange={setWorkspaceId} required />

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
        <input {...register("name")} className={inputCls} placeholder="Rediseño de sitio web" autoFocus />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
        <textarea {...register("description")} rows={3} className={`${inputCls} resize-none`} placeholder="Descripción del proyecto..." />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Client */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
          <select {...register("clientId")} className={inputCls}>
            <option value="">Sin cliente asignado</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
          <select {...register("status")} className={inputCls}>
            <option value="planning">Planeación</option>
            <option value="active">Activo</option>
            <option value="paused">Pausado</option>
            <option value="completed">Completado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Prioridad</label>
          <select {...register("priority")} className={inputCls}>
            <option value="low">Baja</option>
            <option value="medium">Media</option>
            <option value="high">Alta</option>
          </select>
        </div>

        {/* Range */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Rango</label>
          <select {...register("range")} className={inputCls}>
            <option value="">Sin definir</option>
            <option value="short">Corto plazo</option>
            <option value="long">Largo plazo</option>
          </select>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
          <input {...register("category")} className={inputCls} placeholder="Ej: Marketing, Desarrollo, Diseño..." list="category-suggestions" />
          <datalist id="category-suggestions">
            {["Marketing", "Desarrollo", "Diseño", "Ventas", "Operaciones", "Soporte", "I+D", "Legal", "Finanzas"].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        {/* Privacy */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Privacidad</label>
          <div className="flex gap-3 mt-1">
            {[
              { value: "public",  label: "Público",  desc: "Visible para todos" },
              { value: "private", label: "Solo yo",  desc: "Solo tú lo ves" },
            ].map((opt) => (
              <label key={opt.value} className="flex items-start gap-2 cursor-pointer flex-1">
                <input {...register("privacy")} type="radio" value={opt.value} className="mt-0.5 accent-[#1e3a5f]" />
                <span>
                  <span className="block text-sm font-medium text-slate-700">{opt.label}</span>
                  <span className="block text-xs text-slate-400">{opt.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Start date */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Fecha inicio</label>
          <input {...register("startDate")} type="date" className={inputCls} />
        </div>

        {/* End date */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Fecha fin</label>
          <input {...register("endDate")} type="date" className={inputCls} />
        </div>
      </div>

      {/* Share with */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Compartir con...</label>
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              onFocus={() => userResults.length > 0 && setShowUserDropdown(true)}
              onBlur={() => setTimeout(() => setShowUserDropdown(false), 150)}
              placeholder="Buscar usuario por nombre o email..."
              className={`${inputCls} pl-9`}
            />
            {searchingUsers && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
            )}
          </div>

          {showUserDropdown && userResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-20">
              {userResults.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onMouseDown={() => addUser(u)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 text-left transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[#1e3a5f] text-white text-xs flex items-center justify-center font-medium flex-shrink-0">
                    {(u.name ?? u.email)[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{u.name ?? u.email}</p>
                    {u.name && <p className="text-xs text-slate-400 truncate">{u.email}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selected users list */}
        {sharedWith.length > 0 && (
          <div className="mt-2 space-y-2">
            {sharedWith.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-[#1e3a5f] text-white text-xs flex items-center justify-center font-medium flex-shrink-0">
                    {(u.name ?? u.email)[0].toUpperCase()}
                  </div>
                  <span className="text-sm text-slate-700 truncate">{u.name ?? u.email}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => togglePermission(u.id)}
                    className="text-xs px-2 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-white transition-colors"
                  >
                    {u.permission === "view" ? "Ver" : "Editar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeUser(u.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {isLoading ? "Guardando..." : "Guardar proyecto"}
        </button>
      </div>
    </form>
  );
}
