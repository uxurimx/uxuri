"use client";

import Link from "next/link";
import { Plus, UserSearch } from "lucide-react";

export function CareersHeader({ totalJobs }: { totalJobs: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#1e3a5f] flex items-center justify-center">
          <UserSearch className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--skin-text,#0f172a)]">Vacantes</h1>
          <p className="text-sm text-[var(--skin-text-muted,#64748b)]">
            {totalJobs === 0 ? "Sin vacantes publicadas" : `${totalJobs} vacante${totalJobs !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>
      <Link
        href="/careers/new"
        className="inline-flex items-center gap-2 bg-[#1e3a5f] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#162d4a] transition-colors"
      >
        <Plus className="w-4 h-4" />
        Nueva vacante
      </Link>
    </div>
  );
}
