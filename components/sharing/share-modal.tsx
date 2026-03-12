"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Users, Search, Trash2, ChevronDown } from "lucide-react";

type ResourceType = "objective" | "project" | "client" | "task";

interface ShareEntry {
  id: string;
  sharedWithId: string;
  permission: "view" | "edit";
  createdAt: string;
  sharedWithName: string | null;
  sharedWithEmail: string | null;
  sharedWithImage: string | null;
}

interface UserResult {
  id: string;
  name: string | null;
  email: string;
  imageUrl: string | null;
}

interface Props {
  resourceType: ResourceType;
  resourceId: string;
  resourceTitle: string;
  onClose: () => void;
}

const PERMISSION_LABELS = { view: "Ver", edit: "Editar" };

export function ShareModal({ resourceType, resourceId, resourceTitle, onClose }: Props) {
  const [shares, setShares] = useState<ShareEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/shares?resourceType=${resourceType}&resourceId=${resourceId}`);
    if (res.ok) setShares(await res.json());
    setLoading(false);
  }, [resourceType, resourceId]);

  useEffect(() => { load(); }, [load]);

  // Debounced user search
  useEffect(() => {
    if (query.length < 2) { setSearchResults([]); setShowDropdown(false); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data: UserResult[] = await res.json();
        // Exclude already-shared users
        const existing = new Set(shares.map((s) => s.sharedWithId));
        setSearchResults(data.filter((u) => !existing.has(u.id)));
        setShowDropdown(true);
      }
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [query, shares]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function addShare(user: UserResult, permission: "view" | "edit" = "view") {
    setAdding(true);
    setShowDropdown(false);
    setQuery("");
    await fetch("/api/shares", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceType, resourceId, sharedWithId: user.id, permission }),
    });
    await load();
    setAdding(false);
  }

  async function updatePermission(shareId: string, permission: "view" | "edit") {
    setShares((prev) => prev.map((s) => s.id === shareId ? { ...s, permission } : s));
    await fetch(`/api/shares/${shareId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permission }),
    });
  }

  async function revoke(shareId: string) {
    setShares((prev) => prev.filter((s) => s.id !== shareId));
    await fetch(`/api/shares/${shareId}`, { method: "DELETE" });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <div>
              <p className="font-semibold text-slate-800">Compartir</p>
              <p className="text-xs text-slate-500 truncate max-w-[250px]">{resourceTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-100">
          <div ref={searchRef} className="relative">
            <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-400">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Buscar usuario por nombre o correo..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 text-sm outline-none bg-transparent text-slate-700 placeholder-slate-400"
              />
              {searching && <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
            </div>

            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => addShare(user)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 text-left"
                  >
                    {user.imageUrl ? (
                      <img src={user.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-xs">
                        {(user.name ?? user.email)[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{user.name ?? user.email}</p>
                      {user.name && <p className="text-xs text-slate-400 truncate">{user.email}</p>}
                    </div>
                    <span className="text-xs text-blue-600 font-medium">+ Agregar</span>
                  </button>
                ))}
              </div>
            )}

            {showDropdown && searchResults.length === 0 && !searching && query.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 px-3 py-4 text-center">
                <p className="text-sm text-slate-400">No se encontraron usuarios</p>
              </div>
            )}
          </div>
        </div>

        {/* Shared with list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : shares.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Aún no has compartido este recurso</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Acceso compartido</p>
              {shares.map((share) => (
                <div key={share.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50">
                  {share.sharedWithImage ? (
                    <img src={share.sharedWithImage} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-semibold text-xs">
                      {((share.sharedWithName ?? share.sharedWithEmail ?? "?")[0]).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {share.sharedWithName ?? share.sharedWithEmail ?? share.sharedWithId}
                    </p>
                    {share.sharedWithName && share.sharedWithEmail && (
                      <p className="text-xs text-slate-400 truncate">{share.sharedWithEmail}</p>
                    )}
                  </div>
                  <PermissionSelect
                    value={share.permission}
                    onChange={(p) => updatePermission(share.id, p)}
                  />
                  <button
                    onClick={() => revoke(share.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {adding && (
          <div className="px-4 pb-2 text-xs text-blue-600 flex items-center gap-1">
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Agregando...
          </div>
        )}
      </div>
    </div>
  );
}

function PermissionSelect({
  value,
  onChange,
}: {
  value: "view" | "edit";
  onChange: (p: "view" | "edit") => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as "view" | "edit")}
        className="appearance-none text-xs font-medium text-slate-600 bg-slate-100 rounded-lg pl-2.5 pr-6 py-1.5 border-0 outline-none cursor-pointer hover:bg-slate-200 transition-colors"
      >
        <option value="view">Ver</option>
        <option value="edit">Editar</option>
      </select>
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
    </div>
  );
}
