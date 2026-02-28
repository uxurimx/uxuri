// Colores rotativos para roles dinámicos
const BADGE_COLORS = [
  "bg-purple-50 text-purple-700 border-purple-200",
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-amber-50 text-amber-700 border-amber-200",
  "bg-rose-50 text-rose-700 border-rose-200",
  "bg-slate-50 text-slate-600 border-slate-200",
];

function colorForRole(role: string): string {
  // Hash simple del nombre para color consistente
  const sum = role.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return BADGE_COLORS[sum % BADGE_COLORS.length];
}

export function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${colorForRole(role)}`}
    >
      {role}
    </span>
  );
}
