"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";

export function SetupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSetup() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/setup", { method: "POST" });
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error ?? "Error desconocido");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center space-y-5">
        <div className="w-14 h-14 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-7 h-7 text-[#1e3a5f]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuración inicial</h1>
          <p className="text-slate-500 text-sm mt-2">
            No hay ningún administrador registrado en el sistema. Haz clic para
            convertirte en el primer administrador y gestionar el resto de usuarios.
          </p>
        </div>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>
        )}
        <button
          onClick={handleSetup}
          disabled={loading}
          className="w-full px-4 py-2.5 bg-[#1e3a5f] text-white rounded-xl font-medium hover:bg-[#162d4a] transition-colors disabled:opacity-50"
        >
          {loading ? "Configurando..." : "Convertirme en administrador"}
        </button>
      </div>
    </div>
  );
}
