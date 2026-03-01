interface AgentBadgeProps {
  avatar: string;
  name: string;
  color: string;
}

export function AgentBadge({ avatar, name, color }: AgentBadgeProps) {
  return (
    <span
      className="flex items-center gap-0.5 text-xs text-slate-500"
      title={name}
    >
      <span
        className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0"
        style={{ backgroundColor: color + "25" }}
      >
        {avatar}
      </span>
      <span className="max-w-[60px] truncate">{name}</span>
    </span>
  );
}
