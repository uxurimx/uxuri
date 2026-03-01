"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

type User = { id: string; name: string | null };

interface MentionInputProps {
  value: string;
  onChange: (val: string) => void;
  users: User[];
  placeholder?: string;
  onEnter?: () => void;
  disabled?: boolean;
}

// Extracts the active @query before the cursor (returns null if not in a mention)
function getActiveMention(text: string, cursor: number): { query: string; start: number } | null {
  const before = text.slice(0, cursor);
  // Match last @ not already inside @[...] format
  const m = before.match(/@([^@[\]()]*?)$/);
  if (!m) return null;
  return { query: m[1], start: cursor - m[0].length };
}

// Parse @[Name](userId) → { name, id }[]
export function parseMentions(content: string): { name: string; id: string }[] {
  const regex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const results: { name: string; id: string }[] = [];
  let m;
  while ((m = regex.exec(content)) !== null) {
    results.push({ name: m[1], id: m[2] });
  }
  return results;
}

// Render @[Name](userId) as a styled React node
export function renderWithMentions(content: string): React.ReactNode {
  const parts = content.split(/(@\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, i) => {
    const m = part.match(/^@\[([^\]]+)\]\(([^)]+)\)$/);
    if (m) {
      return (
        <span key={i} className="inline-flex items-center bg-blue-100 text-blue-700 rounded px-1 font-medium text-xs">
          @{m[1]}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function MentionInput({
  value,
  onChange,
  users,
  placeholder,
  onEnter,
  disabled,
}: MentionInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const filtered = mention
    ? users
        .filter((u) => (u.name ?? "").toLowerCase().includes(mention.query.toLowerCase()))
        .slice(0, 6)
    : [];

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    const cursor = e.target.selectionStart ?? val.length;
    onChange(val);
    const active = getActiveMention(val, cursor);
    setMention(active);
    setSelectedIdx(0);
  }

  function insertMention(user: User) {
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const tag = `@[${user.name ?? user.id}](${user.id})`;
    const mentionStart = mention?.start ?? cursor;
    const before = value.slice(0, mentionStart);
    const after = value.slice(cursor);
    const next = before + tag + " " + after;
    onChange(next);
    setMention(null);
    const newCursor = mentionStart + tag.length + 1;
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mention !== null && filtered.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => (i + 1) % filtered.length); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelectedIdx((i) => (i - 1 + filtered.length) % filtered.length); return; }
      if (e.key === "Tab" || (e.key === "Enter" && filtered.length > 0)) {
        e.preventDefault();
        insertMention(filtered[selectedIdx]);
        return;
      }
      if (e.key === "Escape") { setMention(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onEnter?.();
    }
  }

  return (
    <div className="relative flex-1">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        rows={2}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 resize-none"
      />

      {/* @ mention dropdown */}
      {mention !== null && filtered.length > 0 && (
        <div className="absolute bottom-full mb-1 left-0 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {filtered.map((user, i) => (
            <button
              key={user.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); insertMention(user); }}
              className={cn(
                "w-full px-3 py-2 text-left text-sm flex items-center gap-1.5 transition-colors",
                i === selectedIdx
                  ? "bg-[#1e3a5f] text-white"
                  : "hover:bg-slate-50 text-slate-700"
              )}
            >
              <span className={cn("font-semibold", i === selectedIdx ? "text-white/70" : "text-[#1e3a5f]")}>@</span>
              {user.name ?? user.id}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
