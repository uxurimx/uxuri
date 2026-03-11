"use client";

import { useState, useRef } from "react";
import { Plus, Pin, Trash2, Search, X, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export type NoteItem = {
  id: string;
  title: string | null;
  content: string;
  tags: string[];
  color: string;
  isPinned: boolean;
  updatedAt: string;
};

const NOTE_COLORS = [
  { value: "#ffffff", label: "Blanco" },
  { value: "#fef9c3", label: "Amarillo" },
  { value: "#dcfce7", label: "Verde" },
  { value: "#dbeafe", label: "Azul" },
  { value: "#fce7f3", label: "Rosa" },
  { value: "#ede9fe", label: "Violeta" },
  { value: "#ffedd5", label: "Naranja" },
  { value: "#f1f5f9", label: "Gris" },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `hace ${days}d`;
  return new Date(dateStr).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

// ─── Component ───────────────────────────────────────────────────────────────

interface NotesClientProps {
  initialNotes: NoteItem[];
}

export function NotesClient({ initialNotes }: NotesClientProps) {
  const [notes, setNotes] = useState<NoteItem[]>(initialNotes);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // New note state
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newColor, setNewColor] = useState("#fef9c3");
  const [newTagInput, setNewTagInput] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);

  // All unique tags
  const allTags = Array.from(new Set(notes.flatMap((n) => n.tags))).sort();

  // Filtered notes
  const filtered = notes.filter((n) => {
    if (activeTag && !n.tags.includes(activeTag)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (n.title?.toLowerCase().includes(q) ?? false) || n.content.toLowerCase().includes(q);
    }
    return true;
  });

  const pinned = filtered.filter((n) => n.isPinned);
  const unpinned = filtered.filter((n) => !n.isPinned);

  // ── Create ──
  async function handleCreate() {
    if (!newContent.trim() && !newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle || null, content: newContent, tags: newTags, color: newColor }),
      });
      if (res.ok) {
        const note = await res.json();
        setNotes((prev) => [note, ...prev]);
        setNewTitle(""); setNewContent(""); setNewTags([]); setNewColor("#fef9c3"); setNewTagInput("");
        setEditingId(null);
      }
    } finally {
      setCreating(false);
    }
  }

  // ── Pin toggle ──
  async function handlePin(note: NoteItem) {
    setNotes((prev) => prev.map((n) => n.id === note.id ? { ...n, isPinned: !n.isPinned } : n));
    await fetch(`/api/notes/${note.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: !note.isPinned }),
    });
  }

  // ── Delete ──
  async function handleDelete(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
  }

  // ── Add tag to new note ──
  function addNewTag(tag: string) {
    const t = tag.trim().toLowerCase();
    if (t && !newTags.includes(t)) setNewTags((prev) => [...prev, t]);
    setNewTagInput("");
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notas</h1>
          <p className="text-sm text-slate-500 mt-0.5">Captura ideas y pensamientos rápidamente</p>
        </div>
      </div>

      {/* Search + tag filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar notas..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 bg-white"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {allTags.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                className={cn(
                  "flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border transition-all",
                  activeTag === tag
                    ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                )}
              >
                <Tag className="w-3 h-3" />
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick create card */}
      <QuickCreateCard
        title={newTitle}
        content={newContent}
        color={newColor}
        tags={newTags}
        tagInput={newTagInput}
        creating={creating}
        onTitleChange={setNewTitle}
        onContentChange={setNewContent}
        onColorChange={setNewColor}
        onTagInputChange={setNewTagInput}
        onAddTag={addNewTag}
        onRemoveTag={(t) => setNewTags((prev) => prev.filter((x) => x !== t))}
        onCreate={handleCreate}
      />

      {/* Pinned */}
      {pinned.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Pin className="w-3.5 h-3.5" /> Fijadas
          </h2>
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
            {pinned.map((note) => (
              <NoteCard key={note.id} note={note} onPin={handlePin} onDelete={handleDelete} />
            ))}
          </div>
        </section>
      )}

      {/* All / unpinned */}
      {unpinned.length > 0 && (
        <section>
          {pinned.length > 0 && (
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Otras notas</h2>
          )}
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
            {unpinned.map((note) => (
              <NoteCard key={note.id} note={note} onPin={handlePin} onDelete={handleDelete} />
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📝</div>
          <p className="text-slate-500 font-medium">
            {search || activeTag ? "Sin resultados" : "Aún no tienes notas"}
          </p>
          <p className="text-slate-400 text-sm mt-1">
            {!search && !activeTag && "Empieza escribiendo arriba ↑"}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── QuickCreateCard ──────────────────────────────────────────────────────────

function QuickCreateCard({
  title, content, color, tags, tagInput, creating,
  onTitleChange, onContentChange, onColorChange, onTagInputChange, onAddTag, onRemoveTag, onCreate,
}: {
  title: string; content: string; color: string; tags: string[]; tagInput: string; creating: boolean;
  onTitleChange: (v: string) => void; onContentChange: (v: string) => void;
  onColorChange: (v: string) => void; onTagInputChange: (v: string) => void;
  onAddTag: (v: string) => void; onRemoveTag: (v: string) => void; onCreate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-2xl border-2 border-dashed border-slate-200 transition-all hover:border-slate-300"
      style={{ backgroundColor: expanded ? color : "white" }}
    >
      {!expanded ? (
        <button
          onClick={() => setExpanded(true)}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
        >
          <Plus className="w-5 h-5 text-slate-400" />
          <span className="text-sm text-slate-400">Toma una nota...</span>
        </button>
      ) : (
        <div className="p-4 space-y-3">
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Título (opcional)"
            className="w-full text-sm font-semibold text-slate-800 placeholder-slate-300 focus:outline-none bg-transparent"
          />
          <textarea
            autoFocus
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder="Escribe tu nota aquí..."
            rows={4}
            className="w-full text-sm text-slate-700 placeholder-slate-300 resize-none focus:outline-none bg-transparent"
          />

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {tags.map((t) => (
                <span key={t} className="flex items-center gap-1 text-xs px-2 py-0.5 bg-black/10 rounded-full text-slate-600">
                  {t}
                  <button onClick={() => onRemoveTag(t)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            {/* Color picker */}
            <div className="flex gap-1.5">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => onColorChange(c.value)}
                  className={cn("w-5 h-5 rounded-full border transition-all", color === c.value ? "border-slate-600 scale-110" : "border-slate-300")}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>

            {/* Tag input */}
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Tag className="w-3 h-3" />
              <input
                value={tagInput}
                onChange={(e) => onTagInputChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); onAddTag(tagInput); } }}
                placeholder="Agregar etiqueta"
                className="w-24 focus:outline-none text-xs bg-transparent placeholder-slate-300"
              />
            </div>

            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => setExpanded(false)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:bg-black/5 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={() => { onCreate(); setExpanded(false); }}
                disabled={creating || (!content.trim() && !title.trim())}
                className="px-3 py-1.5 text-xs bg-[#1e3a5f] text-white rounded-lg hover:bg-[#162d4a] disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NoteCard ─────────────────────────────────────────────────────────────────

function NoteCard({
  note, onPin, onDelete,
}: {
  note: NoteItem;
  onPin: (note: NoteItem) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title ?? "");
  const [editContent, setEditContent] = useState(note.content);
  const [editTags, setEditTags] = useState<string[]>(note.tags);
  const [editColor, setEditColor] = useState(note.color);
  const [editTagInput, setEditTagInput] = useState("");
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  function scheduleUpdate(patch: Partial<NoteItem>) {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      fetch(`/api/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    }, 800);
  }

  if (editing) {
    return (
      <div className="break-inside-avoid rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3" style={{ backgroundColor: editColor }}>
        <input
          value={editTitle}
          onChange={(e) => { setEditTitle(e.target.value); scheduleUpdate({ title: e.target.value || null }); }}
          placeholder="Título"
          className="w-full text-sm font-semibold text-slate-800 placeholder-slate-300 focus:outline-none bg-transparent"
        />
        <textarea
          autoFocus
          value={editContent}
          onChange={(e) => { setEditContent(e.target.value); scheduleUpdate({ content: e.target.value }); }}
          rows={5}
          className="w-full text-sm text-slate-700 resize-none focus:outline-none bg-transparent"
        />
        {editTags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {editTags.map((t) => (
              <span key={t} className="flex items-center gap-1 text-xs px-2 py-0.5 bg-black/10 rounded-full text-slate-600">
                {t}<button onClick={() => { const updated = editTags.filter((x) => x !== t); setEditTags(updated); scheduleUpdate({ tags: updated }); }}><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {NOTE_COLORS.map((c) => (
              <button key={c.value} type="button"
                onClick={() => { setEditColor(c.value); scheduleUpdate({ color: c.value }); }}
                className={cn("w-4 h-4 rounded-full border transition-all", editColor === c.value ? "border-slate-600 scale-110" : "border-slate-300")}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
          <input
            value={editTagInput}
            onChange={(e) => setEditTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                const t = editTagInput.trim().toLowerCase();
                if (t && !editTags.includes(t)) { const updated = [...editTags, t]; setEditTags(updated); scheduleUpdate({ tags: updated }); }
                setEditTagInput("");
              }
            }}
            placeholder="Etiqueta"
            className="w-20 text-xs focus:outline-none bg-transparent text-slate-500 placeholder-slate-300"
          />
          <button onClick={() => setEditing(false)} className="ml-auto px-3 py-1 text-xs bg-[#1e3a5f] text-white rounded-lg">Listo</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="break-inside-avoid rounded-2xl border border-slate-200 p-4 shadow-sm group cursor-pointer hover:shadow-md transition-shadow relative"
      style={{ backgroundColor: note.color }}
      onClick={() => setEditing(true)}
    >
      {note.title && (
        <p className="font-semibold text-sm text-slate-800 mb-2">{note.title}</p>
      )}
      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed line-clamp-10">{note.content}</p>
      {note.tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-3">
          {note.tags.map((t) => (
            <span key={t} className="text-xs px-2 py-0.5 bg-black/8 rounded-full text-slate-500">{t}</span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-black/5">
        <span className="text-xs text-slate-400">{timeAgo(note.updatedAt)}</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onPin(note)}
            className={cn("p-1.5 rounded-lg transition-colors", note.isPinned ? "text-[#1e3a5f]" : "text-slate-400 hover:text-slate-600 hover:bg-black/5")}
            title={note.isPinned ? "Desfijar" : "Fijar"}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Eliminar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
