import { cn } from "@/lib/utils";
import type { Role } from "@/lib/auth";

const roleConfig: Record<Role, { label: string; className: string }> = {
  admin: {
    label: "Admin",
    className: "bg-purple-50 text-purple-700 border-purple-200",
  },
  manager: {
    label: "Manager",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  client: {
    label: "Cliente",
    className: "bg-slate-50 text-slate-600 border-slate-200",
  },
};

export function RoleBadge({ role }: { role: Role }) {
  const config = roleConfig[role];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
