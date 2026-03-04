"use client";

interface ProgressBarProps {
  label: string;
  value: number | null;
  color?: string;
}

function ProgressBar({ label, value, color = "bg-[#1e3a5f]" }: ProgressBarProps) {
  if (value === null) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="font-semibold text-slate-700">{value}%</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

interface ObjectiveProgressProps {
  progress: {
    tasks: number | null;
    projects: number | null;
    milestones: number | null;
    overall: number;
  };
}

export function ObjectiveProgress({ progress }: ObjectiveProgressProps) {
  const hasSub =
    progress.tasks !== null || progress.projects !== null || progress.milestones !== null;

  return (
    <div className="space-y-3">
      {/* Overall */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">Progreso general</span>
          <span className="font-bold text-[#1e3a5f]">{progress.overall}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#1e3a5f] rounded-full transition-all duration-500"
            style={{ width: `${progress.overall}%` }}
          />
        </div>
      </div>

      {hasSub && (
        <div className="pl-2 space-y-2 border-l-2 border-slate-100">
          <ProgressBar label="Tareas" value={progress.tasks} color="bg-blue-500" />
          <ProgressBar label="Proyectos" value={progress.projects} color="bg-emerald-500" />
          <ProgressBar label="Hitos" value={progress.milestones} color="bg-amber-500" />
        </div>
      )}
    </div>
  );
}
