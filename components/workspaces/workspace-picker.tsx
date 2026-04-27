"use client";

import { useEffect, useState } from "react";

type WsOption = { id: string; name: string; icon: string | null; color: string | null };

interface WorkspacePickerProps {
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
  className?: string;
}

/**
 * Renders a workspace selector only when in global mode.
 * In normal mode (active workspace cookie set), returns null.
 */
export function WorkspacePicker({ value, onChange, required, className }: WorkspacePickerProps) {
  const [workspaces, setWorkspaces] = useState<WsOption[]>([]);
  const [isGlobal, setIsGlobal] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/workspaces/context", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setIsGlobal(d.isGlobalMode ?? false);
        setWorkspaces(d.workspaces ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded || !isGlobal) return null;

  const inputCls =
    "w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 bg-indigo-50/50 " +
    (className ?? "");

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        🌐 Workspace{required && <span className="text-red-500 ml-0.5">*</span>}
        <span className="ml-2 text-[11px] font-normal text-indigo-500">Vista global activa</span>
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
        required={required}
      >
        <option value="">Selecciona un workspace</option>
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.icon ?? "🏢"} {w.name}
          </option>
        ))}
      </select>
    </div>
  );
}
