"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import { Flag, Pencil, Trash2, UserCircle, User, Folder, Plus, X } from "lucide-react";
import { AgentBadge } from "@/components/agents/agent-badge";
import { TaskModal, type TaskForModal } from "./task-modal";
import { TasksToolbar, type TaskFilters, DEFAULT_TASK_FILTERS } from "./tasks-toolbar";
import { TaskListView } from "./task-list-view";
import { getPusherClient } from "@/lib/pusher";

export type TaskWithProject = {
  id: string;
  title: string;
  description: string | null;
  projectId: string | null;
  clientId: string | null;
  assignedTo: string | null;
  agentId: string | null;
  customColumnId: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  projectName: string | null;
  /** Personal override: this user marked the task as done for themselves */
  personalDone: boolean;
};

type User = { id: string; name: string | null };
type AgentOption = { id: string; name: string; avatar: string; color: string };
export type CustomColumn = { id: string; name: string; color: string; sortOrder: number };

const SYSTEM_COLUMNS = [
  { id: "todo" as const,        label: "Por hacer",   color: "bg-slate-100",  headerColor: "text-slate-600" },
  { id: "in_progress" as const, label: "En progreso", color: "bg-blue-50",    headerColor: "text-blue-700" },
  { id: "review" as const,      label: "Revisión",    color: "bg-purple-50",  headerColor: "text-purple-700" },
  { id: "done" as const,        label: "Hecho",       color: "bg-emerald-50", headerColor: "text-emerald-700" },
];

const CUSTOM_COL_COLORS = [
  "#94a3b8", "#3b82f6", "#8b5cf6", "#10b981",
  "#f59e0b", "#ef4444", "#ec4899", "#0ea5e9",
  "#f97316", "#14b8a6",
];

const priorityConfig = {
  low:    { label: "Baja",    color: "text-slate-400" },
  medium: { label: "Media",   color: "text-amber-500" },
  high:   { label: "Alta",    color: "text-orange-500" },
  urgent: { label: "Urgente", color: "text-red-500" },
};

type StalenessLevel = { level: "warn" | "alert"; days: number } | null;

function getStaleness(updatedAt: Date, status: TaskWithProject["status"]): StalenessLevel {
  if (status === "done") return null;
  const diffDays = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 1) return null;
  const days = Math.floor(diffDays);
  return { level: diffDays < 3 ? "warn" : "alert", days };
}

function StalenessTag({ updatedAt, status }: { updatedAt: Date; status: TaskWithProject["status"] }) {
  const s = getStaleness(updatedAt, status);
  if (!s) return null;
  const label = `Sin movimiento hace ${s.days} día${s.days !== 1 ? "s" : ""}`;
  return (
    <span title={label} className="flex items-center gap-0.5 ml-1 flex-shrink-0">
      <span className={cn(
        "inline-block w-1.5 h-1.5 rounded-full flex-shrink-0",
        s.level === "warn" ? "bg-amber-400" : "bg-red-500 animate-pulse"
      )} />
      <span className={cn("text-[10px] font-semibold tabular-nums", s.level === "warn" ? "text-amber-500" : "text-red-500")}>
        {s.days}d
      </span>
    </span>
  );
}

function sortByOrder(a: TaskWithProject, b: TaskWithProject): number {
  if (a.sortOrder !== null && b.sortOrder !== null) return a.sortOrder - b.sortOrder;
  if (a.sortOrder !== null) return -1;
  if (b.sortOrder !== null) return 1;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

// ── Reusable task card list ─────────────────────────────────────────
interface TaskCardListProps {
  tasks: TaskWithProject[];
  draggingId: string | null;
  dragOverTaskId: string | null;
  currentUserId?: string;
  users?: User[];
  agents?: AgentOption[];
  showProjectName: boolean;
  onView: (task: TaskWithProject) => void;
  onEdit: (task: TaskWithProject) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, task: TaskWithProject) => void;
  onDrop: (e: React.DragEvent, task: TaskWithProject) => void;
}

function TaskCardList({
  tasks, draggingId, dragOverTaskId, currentUserId, users, agents, showProjectName,
  onView, onEdit, onDelete, deletingId, onDragStart, onDragEnd, onDragOver, onDrop,
}: TaskCardListProps) {
  return (
    <div className="space-y-3 min-h-[120px]">
      {tasks.map((task) => {
        const priority = priorityConfig[task.priority];
        const isOwner = !task.createdBy || task.createdBy === currentUserId;
        const assignedUser = users?.find((u) => u.id === task.assignedTo);
        const assignedAgent = agents?.find((a) => a.id === task.agentId);
        const creatorName = task.createdBy ? (users?.find((u) => u.id === task.createdBy)?.name ?? null) : null;
        const isDragTarget = dragOverTaskId === task.id && draggingId && draggingId !== task.id;
        const hasFooter = creatorName || (showProjectName && task.projectName);

        return (
          <div
            key={task.id}
            draggable
            onDragStart={(e) => onDragStart(e, task.id)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => onDragOver(e, task)}
            onDrop={(e) => onDrop(e, task)}
            onClick={() => onView(task)}
            className={cn(
              "group bg-white rounded-xl border border-slate-200 p-3 cursor-pointer hover:shadow-sm hover:border-slate-300 transition-all",
              draggingId === task.id && "opacity-40",
              isDragTarget && "border-t-2 border-t-[#1e3a5f]",
              task.personalDone && "opacity-60"
            )}
          >
            {/* Title + action buttons */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-sm font-medium text-slate-900 leading-snug flex-1">{task.title}</p>
              {isOwner && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onEdit(task); }}
                    className="p-1 rounded-md text-slate-400 hover:text-[#1e3a5f] hover:bg-slate-100 transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                    disabled={deletingId === task.id}
                    className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {task.description && (
              <p className="text-xs text-slate-500 mb-2 line-clamp-2">{task.description}</p>
            )}

            {/* Priority + staleness + date + assigned */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Flag className={cn("w-3 h-3", priority.color)} />
                <span className={cn("text-xs font-medium", priority.color)}>{priority.label}</span>
                <StalenessTag updatedAt={task.updatedAt} status={task.status} />
              </div>
              <div className="flex items-center gap-2">
                {task.dueDate && (
                  <span className="text-xs text-slate-400">{formatDate(task.dueDate)}</span>
                )}
                {assignedUser && (
                  <span className="text-xs text-slate-500 flex items-center gap-0.5" title={assignedUser.name ?? "Asignado"}>
                    <UserCircle className="w-3.5 h-3.5 text-slate-400" />
                    <span className="max-w-[60px] truncate">{assignedUser.name}</span>
                  </span>
                )}
                {assignedAgent && (
                  <AgentBadge avatar={assignedAgent.avatar} name={assignedAgent.name} color={assignedAgent.color} />
                )}
              </div>
            </div>

            {/* Footer: creator · project */}
            {hasFooter && (
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5 min-w-0">
                {creatorName && (
                  <span className="flex items-center gap-0.5 text-xs text-slate-400 flex-shrink-0">
                    <User className="w-3 h-3" />
                    <span className="max-w-[72px] truncate">{creatorName}</span>
                  </span>
                )}
                {creatorName && showProjectName && task.projectName && (
                  <span className="text-slate-300 text-xs flex-shrink-0">·</span>
                )}
                {showProjectName && task.projectName && (
                  <span className="flex items-center gap-0.5 text-xs text-slate-400 min-w-0">
                    <Folder className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{task.projectName}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {tasks.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 h-24 flex items-center justify-center">
          <p className="text-xs text-slate-300">Arrastra tareas aquí</p>
        </div>
      )}
    </div>
  );
}

interface KanbanBoardProps {
  initialTasks: TaskWithProject[];
  initialCustomColumns?: CustomColumn[];
  projectId?: string;
  showProjectName?: boolean;
  projects?: { id: string; name: string }[];
  users?: User[];
  agents?: AgentOption[];
  currentUserId?: string;
}

export function KanbanBoard({
  initialTasks,
  initialCustomColumns = [],
  projectId,
  showProjectName = true,
  projects,
  users,
  agents,
  currentUserId,
}: KanbanBoardProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>(initialCustomColumns);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskForModal | null>(null);
  const [modalInitialMode, setModalInitialMode] = useState<"view" | "edit" | "create">("create");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Custom column form state
  const [showAddCol, setShowAddCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColColor, setNewColColor] = useState(CUSTOM_COL_COLORS[0]);
  const [addingCol, setAddingCol] = useState(false);

  // Filters state — persisted in localStorage
  const [filters, setFilters] = useState<TaskFilters>(() => {
    if (typeof window === "undefined") return DEFAULT_TASK_FILTERS;
    try {
      const saved = localStorage.getItem("uxuri:task-filters");
      if (saved) return { ...DEFAULT_TASK_FILTERS, ...JSON.parse(saved) };
    } catch { /* ignore */ }
    return DEFAULT_TASK_FILTERS;
  });

  const [view, setView] = useState<"kanban" | "list">(() => {
    if (typeof window === "undefined") return "kanban";
    return (localStorage.getItem("uxuri:task-view") as "kanban" | "list") ?? "kanban";
  });

  function patchFilters(patch: Partial<TaskFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function resetFilters() {
    setFilters(DEFAULT_TASK_FILTERS);
  }

  useEffect(() => {
    localStorage.setItem("uxuri:task-filters", JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    localStorage.setItem("uxuri:task-view", view);
  }, [view]);

  useEffect(() => { setTasks(initialTasks); }, [initialTasks]);
  useEffect(() => { setCustomColumns(initialCustomColumns); }, [initialCustomColumns]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stable refs so Pusher handlers don't capture stale closures
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; }, [router]);

  const projectsRef = useRef(projects);
  useEffect(() => { projectsRef.current = projects; }, [projects]);

  const currentUserIdRef = useRef(currentUserId);
  useEffect(() => { currentUserIdRef.current = currentUserId; }, [currentUserId]);

  // Real-time updates via global tasks channel — works for both /tasks and /projects/[id]
  useEffect(() => {
    const pusher = getPusherClient();
    const channel = pusher.subscribe("tasks-global");

    type RawTask = Omit<TaskWithProject, "projectName" | "createdAt" | "updatedAt" | "personalDone"> & {
      projectId: string | null;
      agentId: string | null;
      createdAt: string | Date;
      updatedAt: string | Date;
    };

    const handleCreated = (task: RawTask) => {
      // On project-specific view, ignore tasks from other projects
      if (projectId && task.projectId !== projectId) return;
      const projectName = projectsRef.current?.find((p) => p.id === task.projectId)?.name ?? null;
      const full: TaskWithProject = {
        ...task, projectName,
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt),
        personalDone: false,
      };
      setTasks((prev) => prev.some((t) => t.id === task.id) ? prev : [...prev, full]);
    };

    const handleUpdated = (task: RawTask) => {
      setTasks((prev) => prev.map((t) => {
        if (t.id !== task.id) return t;
        const projectName = projectsRef.current?.find((p) => p.id === task.projectId)?.name ?? t.projectName;
        // Preserve personalDone — it's user-specific and not broadcast in task events
        return {
          ...task, projectName,
          createdAt: new Date(task.createdAt),
          updatedAt: new Date(task.updatedAt),
          personalDone: t.personalDone,
        };
      }));
    };

    const handleDeleted = ({ taskId }: { taskId: string }) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    };

    channel.bind("task:created", handleCreated);
    channel.bind("task:updated", handleUpdated);
    channel.bind("task:deleted", handleDeleted);

    return () => {
      channel.unbind("task:created", handleCreated);
      channel.unbind("task:updated", handleUpdated);
      channel.unbind("task:deleted", handleDeleted);
      pusher.unsubscribe("tasks-global");
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — projectId is stable; uses refs for others

  const filteredTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks.filter((t) => {
      const effectiveStatus = t.personalDone ? "done" : t.status;

      // Search
      if (filters.search && !t.title.toLowerCase().includes(filters.search.toLowerCase())) return false;

      // Hide done (default ON)
      if (filters.hideDone && effectiveStatus === "done") return false;

      // Priority
      if (filters.priority !== "all" && t.priority !== filters.priority) return false;

      // Assignee
      if (filters.assignee === "me" && t.assignedTo !== currentUserId) return false;
      if (filters.assignee === "unassigned" && t.assignedTo !== null) return false;

      // Project
      if (filters.projectId && t.projectId !== filters.projectId) return false;

      // Due date
      if (filters.dueDateFilter !== "all") {
        const due = t.dueDate ? new Date(t.dueDate) : null;
        if (filters.dueDateFilter === "no-date") {
          if (due) return false;
        } else if (filters.dueDateFilter === "overdue") {
          if (!due || due >= today) return false;
        } else if (filters.dueDateFilter === "this-week") {
          const weekEnd = new Date(today);
          weekEnd.setDate(weekEnd.getDate() + 7);
          if (!due || due < today || due > weekEnd) return false;
        }
      }

      return true;
    });
  }, [tasks, filters, currentUserId]);

  function openCreate() {
    setSelectedTask(null);
    setModalInitialMode("create");
    setModalOpen(true);
  }

  function openView(task: TaskWithProject) {
    setSelectedTask(task);
    setModalInitialMode("view");
    setModalOpen(true);
  }

  function openEdit(task: TaskWithProject) {
    setSelectedTask(task);
    setModalInitialMode("edit");
    setModalOpen(true);
  }

  async function handleDelete(taskId: string) {
    if (!confirm("¿Eliminar esta tarea?")) return;
    setDeletingId(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    setDeletingId(null);
    router.refresh();
  }

  function handleModalClose() {
    setModalOpen(false);
    setSelectedTask(null);
    router.refresh();
  }

  async function handleAddColumn(e: React.FormEvent) {
    e.preventDefault();
    if (!newColName.trim()) return;
    setAddingCol(true);
    try {
      const res = await fetch("/api/workflow-columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newColName.trim(), color: newColColor, sortOrder: customColumns.length }),
      });
      if (res.ok) {
        const col = await res.json();
        setCustomColumns((prev) => [...prev, col]);
        setNewColName("");
        setNewColColor(CUSTOM_COL_COLORS[0]);
        setShowAddCol(false);
      }
    } finally {
      setAddingCol(false);
    }
  }

  async function handleDeleteColumn(colId: string) {
    if (!confirm("¿Eliminar esta columna? Las tareas en ella quedarán sin columna asignada.")) return;
    const res = await fetch(`/api/workflow-columns/${colId}`, { method: "DELETE" });
    if (res.ok) {
      setCustomColumns((prev) => prev.filter((c) => c.id !== colId));
      setTasks((prev) => prev.map((t) => t.customColumnId === colId ? { ...t, customColumnId: null } : t));
    }
  }

  // personalDone overrides the displayed column to "done"
  // System columns exclude tasks that belong to a custom column
  const getColumnTasks = (status: TaskWithProject["status"]) =>
    filteredTasks
      .filter((t) => !t.customColumnId && (t.personalDone ? "done" : t.status) === status)
      .sort(sortByOrder);

  const getCustomColumnTasks = (columnId: string) =>
    filteredTasks.filter((t) => t.customColumnId === columnId).sort(sortByOrder);

  // ── Cross-column drag ──────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
    setDraggingId(taskId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverTaskId(null);
  }, []);

  const handleColumnDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);

  const handleColumnDrop = useCallback(
    async (e: React.DragEvent, targetStatus: TaskWithProject["status"]) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData("taskId");
      if (!taskId) return;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      // Already in this system column (no custom column)
      const effectiveStatus = task.personalDone ? "done" : task.status;
      if (!task.customColumnId && effectiveStatus === targetStatus) return;

      const uid = currentUserIdRef.current;
      const isOwner = !task.createdBy || task.createdBy === uid;
      const isAssigned = task.assignedTo === uid;

      // Only creator or assignee can change global status via drag
      if (!isOwner && !isAssigned) return;

      // Moving to system column also clears customColumnId
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: targetStatus, customColumnId: null } : t));
      try {
        await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus, customColumnId: null }),
        });
        router.refresh();
      } catch {
        setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: task.status, customColumnId: task.customColumnId } : t));
      }
    },
    [tasks, router]
  );

  const handleCustomColumnDrop = useCallback(
    async (e: React.DragEvent, targetColumnId: string) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData("taskId");
      if (!taskId) return;
      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.customColumnId === targetColumnId) return;

      const uid = currentUserIdRef.current;
      const isOwner = !task.createdBy || task.createdBy === uid;
      if (!isOwner) return; // Only creator can move to custom columns

      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, customColumnId: targetColumnId } : t));
      try {
        await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ customColumnId: targetColumnId }),
        });
        router.refresh();
      } catch {
        setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, customColumnId: task.customColumnId } : t));
      }
    },
    [tasks, router]
  );

  // ── Within-column drag (reorder by sortOrder) ──────────────────────
  const handleTaskDragOver = useCallback((e: React.DragEvent, targetTask: TaskWithProject) => {
    const taskId = e.dataTransfer.getData("taskId") || draggingId;
    if (!taskId) return;
    const dragged = tasks.find((t) => t.id === taskId);
    // Same column = same customColumnId, or same status with no customColumnId
    const sameColumn = dragged?.customColumnId !== null
      ? dragged?.customColumnId === targetTask.customColumnId
      : (dragged?.status === targetTask.status && targetTask.customColumnId === null);
    if (sameColumn) {
      e.preventDefault();
      e.stopPropagation();
      setDragOverTaskId(targetTask.id);
    }
  }, [tasks, draggingId]);

  const handleTaskDrop = useCallback(
    async (e: React.DragEvent, targetTask: TaskWithProject) => {
      const taskId = e.dataTransfer.getData("taskId");
      if (!taskId || taskId === targetTask.id) return;
      const dragged = tasks.find((t) => t.id === taskId);
      const sameColumn = dragged?.customColumnId !== null
        ? dragged?.customColumnId === targetTask.customColumnId
        : (dragged?.status === targetTask.status && targetTask.customColumnId === null);
      if (!dragged || !sameColumn) return;

      e.preventDefault();
      e.stopPropagation();
      setDragOverTaskId(null);

      // Compute new sortOrder: insert dragged task before targetTask
      const columnTasks = tasks.filter((t) =>
        targetTask.customColumnId
          ? t.customColumnId === targetTask.customColumnId
          : (t.status === targetTask.status && !t.customColumnId)
      ).sort(sortByOrder);
      const withoutDragged = columnTasks.filter((t) => t.id !== taskId);
      const targetIdx = withoutDragged.findIndex((t) => t.id === targetTask.id);

      const prevTask = withoutDragged[targetIdx - 1] ?? null;
      const prevOrder = prevTask?.sortOrder ?? (targetTask.sortOrder != null ? targetTask.sortOrder - 2000 : 0);
      const nextOrder = targetTask.sortOrder ?? (prevOrder + 2000);
      const newSortOrder = Math.round((prevOrder + nextOrder) / 2);

      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, sortOrder: newSortOrder } : t));

      const isOwner = !dragged.createdBy || dragged.createdBy === currentUserIdRef.current;

      if (isOwner) {
        // Creator: persist to tasks.sortOrder (affects default order for everyone)
        await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: newSortOrder }),
        });
      } else {
        // Non-creator: persist to user_task_preferences.sortOrder (personal, doesn't affect others)
        await fetch(`/api/tasks/${taskId}/preferences`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: newSortOrder }),
        });
      }
    },
    [tasks]
  );

  return (
    <>
      <TasksToolbar
        filters={filters}
        onFiltersChange={patchFilters}
        onResetFilters={resetFilters}
        view={view}
        onViewChange={setView}
        onNewTask={projectId ? openCreate : undefined}
        projects={projects}
        currentUserId={currentUserId}
      />

      {view === "list" ? (
        <TaskListView
          tasks={filteredTasks}
          currentUserId={currentUserId}
          users={users}
          onView={openView}
          onEdit={openEdit}
          onDelete={handleDelete}
          deletingId={deletingId}
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {SYSTEM_COLUMNS.filter((col) => !(col.id === "done" && filters.hideDone)).map((col) => {
            const colTasks = getColumnTasks(col.id);
            return (
              <div
                key={col.id}
                className="flex-shrink-0 w-72"
                onDragOver={handleColumnDragOver}
                onDrop={(e) => handleColumnDrop(e, col.id)}
              >
                {/* Column header */}
                <div className={cn("flex items-center justify-between px-3 py-2 rounded-xl mb-3", col.color)}>
                  <span className={cn("text-sm font-semibold", col.headerColor)}>{col.label}</span>
                  <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded-full bg-white/60", col.headerColor)}>
                    {colTasks.length}
                  </span>
                </div>

                <TaskCardList
                  tasks={colTasks}
                  draggingId={draggingId}
                  dragOverTaskId={dragOverTaskId}
                  currentUserId={currentUserId}
                  users={users}
                  agents={agents}
                  showProjectName={showProjectName}
                  onView={openView}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleTaskDragOver}
                  onDrop={handleTaskDrop}
                />
              </div>
            );
          })}

          {/* Custom columns */}
          {[...customColumns].sort((a, b) => a.sortOrder - b.sortOrder).map((col) => {
            const colTasks = getCustomColumnTasks(col.id);
            return (
              <div
                key={col.id}
                className="flex-shrink-0 w-72"
                onDragOver={handleColumnDragOver}
                onDrop={(e) => handleCustomColumnDrop(e, col.id)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2 rounded-xl mb-3" style={{ backgroundColor: col.color + "22" }}>
                  <span className="text-sm font-semibold" style={{ color: col.color }}>{col.name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-white/60" style={{ color: col.color }}>
                      {colTasks.length}
                    </span>
                    <button
                      onClick={() => handleDeleteColumn(col.id)}
                      className="p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Eliminar columna"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <TaskCardList
                  tasks={colTasks}
                  draggingId={draggingId}
                  dragOverTaskId={dragOverTaskId}
                  currentUserId={currentUserId}
                  users={users}
                  agents={agents}
                  showProjectName={showProjectName}
                  onView={openView}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleTaskDragOver}
                  onDrop={handleTaskDrop}
                />
              </div>
            );
          })}

          {/* Add column button / form */}
          <div className="flex-shrink-0 w-72">
            {showAddCol ? (
              <form onSubmit={handleAddColumn} className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                <input
                  autoFocus
                  type="text"
                  placeholder="Nombre de columna"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
                />
                <div className="flex flex-wrap gap-1.5">
                  {CUSTOM_COL_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColColor(c)}
                      style={{ backgroundColor: c }}
                      className={cn(
                        "w-5 h-5 rounded-full transition-all",
                        newColColor === c ? "ring-2 ring-offset-1 ring-slate-600 scale-110" : "opacity-70 hover:opacity-100"
                      )}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={addingCol || !newColName.trim()}
                    className="flex-1 text-xs font-medium py-1.5 bg-[#1e3a5f] text-white rounded-lg hover:bg-[#16304f] disabled:opacity-50 transition-colors"
                  >
                    {addingCol ? "Creando…" : "Crear columna"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddCol(false); setNewColName(""); }}
                    className="text-xs px-2 py-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowAddCol(true)}
                className="w-full h-10 flex items-center gap-2 px-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl border-2 border-dashed border-slate-200 text-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nueva columna
              </button>
            )}
          </div>
        </div>
      )}

      <TaskModal
        open={modalOpen}
        onClose={handleModalClose}
        projectId={projectId}
        task={selectedTask}
        projects={projects}
        users={users}
        agents={agents}
        currentUserId={currentUserId}
        initialMode={modalInitialMode}
      />
    </>
  );
}
