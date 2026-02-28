"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import { Flag, Pencil, Trash2, UserCircle } from "lucide-react";
import { TaskModal, type TaskForModal } from "./task-modal";
import { TasksToolbar } from "./tasks-toolbar";
import { TaskListView } from "./task-list-view";
import { getPusherClient } from "@/lib/pusher";

export type TaskWithProject = {
  id: string;
  title: string;
  description: string | null;
  projectId: string | null;
  clientId: string | null;
  assignedTo: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  sortOrder: number | null;
  createdAt: Date;
  createdBy: string | null;
  projectName: string | null;
};

type User = { id: string; name: string | null };

const columns = [
  { id: "todo" as const,        label: "Por hacer",   color: "bg-slate-100",  headerColor: "text-slate-600" },
  { id: "in_progress" as const, label: "En progreso", color: "bg-blue-50",    headerColor: "text-blue-700" },
  { id: "review" as const,      label: "Revisión",    color: "bg-purple-50",  headerColor: "text-purple-700" },
  { id: "done" as const,        label: "Hecho",       color: "bg-emerald-50", headerColor: "text-emerald-700" },
];

const priorityConfig = {
  low:    { label: "Baja",    color: "text-slate-400" },
  medium: { label: "Media",   color: "text-amber-500" },
  high:   { label: "Alta",    color: "text-orange-500" },
  urgent: { label: "Urgente", color: "text-red-500" },
};

function sortByOrder(a: TaskWithProject, b: TaskWithProject): number {
  if (a.sortOrder !== null && b.sortOrder !== null) return a.sortOrder - b.sortOrder;
  if (a.sortOrder !== null) return -1;
  if (b.sortOrder !== null) return 1;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

interface KanbanBoardProps {
  initialTasks: TaskWithProject[];
  projectId?: string;
  showProjectName?: boolean;
  projects?: { id: string; name: string }[];
  users?: User[];
  currentUserId?: string;
}

export function KanbanBoard({
  initialTasks,
  projectId,
  showProjectName = true,
  projects,
  users,
  currentUserId,
}: KanbanBoardProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskForModal | null>(null);
  const [modalInitialMode, setModalInitialMode] = useState<"view" | "edit" | "create">("create");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Toolbar state
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [view, setView] = useState<"kanban" | "list">("kanban");

  useEffect(() => { setTasks(initialTasks); }, [initialTasks]);

  // Real-time updates via Pusher — refresh board when tasks change in this project
  useEffect(() => {
    if (!projectId) return;
    const pusher = getPusherClient();
    const channel = pusher.subscribe(`project-${projectId}`);
    channel.bind("task:created", () => router.refresh());
    channel.bind("task:updated", () => router.refresh());
    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`project-${projectId}`);
    };
  }, [projectId, router]);

  const filteredTasks = tasks.filter((t) => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
    return matchSearch && matchPriority;
  });

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

  const getColumnTasks = (status: TaskWithProject["status"]) =>
    filteredTasks.filter((t) => t.status === status).sort(sortByOrder);

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
      if (!task || task.status === targetStatus) return;

      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: targetStatus } : t));
      try {
        await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        });
        router.refresh();
      } catch {
        setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: task.status } : t));
      }
    },
    [tasks, router]
  );

  // ── Within-column drag (reorder by sortOrder) ──────────────────────
  const handleTaskDragOver = useCallback((e: React.DragEvent, targetTask: TaskWithProject) => {
    const taskId = e.dataTransfer.getData("taskId") || draggingId;
    if (!taskId) return;
    const dragged = tasks.find((t) => t.id === taskId);
    if (dragged?.status === targetTask.status) {
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
      if (!dragged || dragged.status !== targetTask.status) return;

      e.preventDefault();
      e.stopPropagation();
      setDragOverTaskId(null);

      // Compute new sortOrder: insert dragged task before targetTask
      const columnTasks = tasks.filter((t) => t.status === targetTask.status).sort(sortByOrder);
      const withoutDragged = columnTasks.filter((t) => t.id !== taskId);
      const targetIdx = withoutDragged.findIndex((t) => t.id === targetTask.id);

      const prevTask = withoutDragged[targetIdx - 1] ?? null;
      const prevOrder = prevTask?.sortOrder ?? (targetTask.sortOrder != null ? targetTask.sortOrder - 2000 : 0);
      const nextOrder = targetTask.sortOrder ?? (prevOrder + 2000);
      const newSortOrder = Math.round((prevOrder + nextOrder) / 2);

      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, sortOrder: newSortOrder } : t));

      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: newSortOrder }),
      });
    },
    [tasks]
  );

  return (
    <>
      <TasksToolbar
        search={search}
        onSearchChange={setSearch}
        priorityFilter={priorityFilter}
        onPriorityChange={setPriorityFilter}
        view={view}
        onViewChange={setView}
        onNewTask={projectId ? openCreate : undefined}
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
          {columns.map((col) => {
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

                {/* Tasks */}
                <div className="space-y-3 min-h-[120px]">
                  {colTasks.map((task) => {
                    const priority = priorityConfig[task.priority];
                    const isOwner = !task.createdBy || task.createdBy === currentUserId;
                    const assignedUser = users?.find((u) => u.id === task.assignedTo);
                    const isDragTarget = dragOverTaskId === task.id && draggingId && draggingId !== task.id;

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleTaskDragOver(e, task)}
                        onDrop={(e) => handleTaskDrop(e, task)}
                        onClick={() => openView(task)}
                        className={cn(
                          "group bg-white rounded-xl border border-slate-200 p-3 cursor-pointer hover:shadow-sm hover:border-slate-300 transition-all",
                          draggingId === task.id && "opacity-40",
                          isDragTarget && "border-t-2 border-t-[#1e3a5f]"
                        )}
                      >
                        {/* Title + action buttons */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-medium text-slate-900 leading-snug flex-1">
                            {task.title}
                          </p>
                          {isOwner && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                              <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); openEdit(task); }}
                                className="p-1 rounded-md text-slate-400 hover:text-[#1e3a5f] hover:bg-slate-100 transition-colors"
                                title="Editar"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}
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

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Flag className={cn("w-3 h-3", priority.color)} />
                            <span className={cn("text-xs font-medium", priority.color)}>{priority.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {task.dueDate && (
                              <span className="text-xs text-slate-400">{formatDate(task.dueDate)}</span>
                            )}
                            {assignedUser && (
                              <span
                                className="text-xs text-slate-500 flex items-center gap-0.5"
                                title={assignedUser.name ?? "Asignado"}
                              >
                                <UserCircle className="w-3.5 h-3.5 text-slate-400" />
                                <span className="max-w-[60px] truncate">{assignedUser.name}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {showProjectName && task.projectName && (
                          <div className="mt-2 pt-2 border-t border-slate-100">
                            <span className="text-xs text-slate-400 truncate block">{task.projectName}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {colTasks.length === 0 && (
                    <div className="rounded-xl border-2 border-dashed border-slate-200 h-24 flex items-center justify-center">
                      <p className="text-xs text-slate-300">Arrastra tareas aquí</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskModal
        open={modalOpen}
        onClose={handleModalClose}
        projectId={projectId}
        task={selectedTask}
        projects={projects}
        users={users}
        currentUserId={currentUserId}
        initialMode={modalInitialMode}
      />
    </>
  );
}
