"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type NodeType = "idea" | "task" | "question" | "insight";

type MindmapNode = {
  id: string;
  label: string;
  type: NodeType;
  x: number;
  y: number;
  parentId: string | null;
};

type MindmapData = {
  nodes: MindmapNode[];
};

const NODE_COLORS: Record<NodeType, string> = {
  idea: "bg-blue-50 border-blue-200 text-blue-900",
  task: "bg-emerald-50 border-emerald-200 text-emerald-900",
  question: "bg-amber-50 border-amber-200 text-amber-900",
  insight: "bg-violet-50 border-violet-200 text-violet-900",
};

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  idea: "Idea",
  task: "Tarea",
  question: "Pregunta",
  insight: "Insight",
};

const DEFAULT_TYPES: NodeType[] = ["idea", "task", "question", "insight"];

let nodeIdCounter = 1;
function genId() {
  return `node-${Date.now()}-${nodeIdCounter++}`;
}

type Props = {
  sessionId: string;
  initialData: Record<string, unknown> | null;
  contextTitle: string;
};

export function PlanningMindmap({ sessionId, initialData, contextTitle }: Props) {
  const [nodes, setNodes] = useState<MindmapNode[]>(() => {
    if (initialData && Array.isArray((initialData as MindmapData).nodes)) {
      return (initialData as MindmapData).nodes;
    }
    return [
      { id: "root", label: contextTitle || "Sesión", type: "idea", x: 140, y: 200, parentId: null },
    ];
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Save on nodes change (debounced)
  useEffect(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      await fetch(`/api/planning/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mindmapData: { nodes } }),
      });
    }, 1000);
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [nodes, sessionId]);

  function addNode() {
    const parent = selectedId ?? "root";
    const parentNode = nodes.find((n) => n.id === parent);
    const newNode: MindmapNode = {
      id: genId(),
      label: "Nueva idea",
      type: "idea",
      x: (parentNode?.x ?? 140) + 160,
      y: (parentNode?.y ?? 200) + (Math.random() - 0.5) * 80,
      parentId: parent,
    };
    setNodes((prev) => [...prev, newNode]);
    setEditingId(newNode.id);
    setEditValue("Nueva idea");
  }

  function deleteNode(id: string) {
    if (id === "root") return;
    setNodes((prev) => prev.filter((n) => n.id !== id && n.parentId !== id));
    setSelectedId(null);
  }

  function startEdit(node: MindmapNode) {
    setEditingId(node.id);
    setEditValue(node.label);
  }

  function commitEdit() {
    if (!editingId) return;
    setNodes((prev) =>
      prev.map((n) => (n.id === editingId ? { ...n, label: editValue } : n))
    );
    setEditingId(null);
  }

  function cycleType(id: string) {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        const idx = DEFAULT_TYPES.indexOf(n.type);
        return { ...n, type: DEFAULT_TYPES[(idx + 1) % DEFAULT_TYPES.length] };
      })
    );
  }

  // Mouse drag
  function onMouseDown(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setSelectedId(id);
    const rect = (e.target as SVGElement).closest(".mindmap-node")?.getBoundingClientRect();
    if (rect) {
      setDragging({ id, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top });
    }
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging || !svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    setNodes((prev) =>
      prev.map((n) =>
        n.id === dragging.id
          ? { ...n, x: e.clientX - svgRect.left - dragging.offsetX + 60, y: e.clientY - svgRect.top - dragging.offsetY + 20 }
          : n
      )
    );
  }

  function onMouseUp() {
    setDragging(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-slate-200">
        <span className="text-sm font-semibold text-slate-700">Mapa mental</span>
        <div className="flex gap-1">
          <button
            onClick={addNode}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
          >
            <Plus className="w-3 h-3" />
            Nodo
          </button>
          {selectedId && selectedId !== "root" && (
            <button
              onClick={() => deleteNode(selectedId)}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-slate-50">
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full"
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
        >
          {/* Edges */}
          {nodes.map((node) => {
            if (!node.parentId) return null;
            const parent = nodes.find((n) => n.id === node.parentId);
            if (!parent) return null;
            return (
              <line
                key={`edge-${node.id}`}
                x1={parent.x + 60}
                y1={parent.y + 20}
                x2={node.x + 60}
                y2={node.y + 20}
                stroke="#cbd5e1"
                strokeWidth={1.5}
              />
            );
          })}
        </svg>

        {/* Nodes */}
        {nodes.map((node) => (
          <div
            key={node.id}
            className={cn(
              "mindmap-node absolute cursor-pointer select-none rounded-xl border-2 px-3 py-1.5 text-xs font-medium shadow-sm min-w-[80px] max-w-[140px]",
              NODE_COLORS[node.type],
              selectedId === node.id && "ring-2 ring-[#1e3a5f] ring-offset-1"
            )}
            style={{ left: node.x, top: node.y }}
            onMouseDown={(e) => onMouseDown(e, node.id)}
            onClick={() => setSelectedId(node.id)}
            onDoubleClick={() => startEdit(node)}
          >
            {editingId === node.id ? (
              <input
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="w-full bg-transparent outline-none text-xs"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="line-clamp-2 break-words">{node.label}</span>
            )}
            {selectedId === node.id && (
              <button
                onClick={(e) => { e.stopPropagation(); cycleType(node.id); }}
                className="absolute -top-2 -right-2 text-[10px] px-1 rounded-full bg-white border border-slate-200 shadow-sm"
              >
                {NODE_TYPE_LABELS[node.type][0]}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="p-2 border-t border-slate-200 text-xs text-slate-400 text-center">
        Doble-clic para editar · Clic en tipo para cambiar · Arrastra para mover
      </div>
    </div>
  );
}
