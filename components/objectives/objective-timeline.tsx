"use client";

import { useMemo } from "react";

interface TimelineItem {
  id: string;
  type: "task" | "milestone" | "project";
  title: string;
  date: string; // YYYY-MM-DD
  areaId?: string;
  color?: string;
}

interface ObjectiveArea {
  id: string;
  objectiveId: string;
  name: string;
  color: string;
  emoji: string | null;
  sortOrder: number | null;
  createdAt: Date;
}

interface ObjectiveTimelineProps {
  linkedTasks: any[];
  linkedProjects: any[];
  milestones: any[];
  areas: ObjectiveArea[];
}

export function ObjectiveTimeline({
  linkedTasks = [],
  linkedProjects = [],
  milestones = [],
  areas = [],
}: ObjectiveTimelineProps) {
  const areaMap = useMemo(
    () => Object.fromEntries(areas.map((a) => [a.id, a])),
    [areas]
  );

  const timelineItems = useMemo(() => {
    const items: TimelineItem[] = [];

    linkedTasks.forEach((task) => {
      if (task.dueDate) {
        const area = task.areaId ? areaMap[task.areaId] : null;
        items.push({
          id: task.id,
          type: "task",
          title: task.title,
          date: task.dueDate,
          areaId: task.areaId,
          color: area?.color || "#3b82f6",
        });
      }
    });

    linkedProjects.forEach((project) => {
      if (project.endDate) {
        const area = project.areaId ? areaMap[project.areaId] : null;
        items.push({
          id: project.id,
          type: "project",
          title: project.name,
          date: project.endDate,
          areaId: project.areaId,
          color: area?.color || "#10b981",
        });
      }
    });

    milestones.forEach((milestone) => {
      if (milestone.dueDate) {
        items.push({
          id: milestone.id,
          type: "milestone",
          title: milestone.title,
          date: milestone.dueDate,
          color: "#f59e0b",
        });
      }
    });

    return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [linkedTasks, linkedProjects, milestones, areaMap]);

  const dateRange = useMemo(() => {
    if (timelineItems.length === 0) {
      const today = new Date();
      return {
        start: new Date(today.getFullYear(), today.getMonth(), 1),
        end: new Date(today.getFullYear(), today.getMonth() + 1, 0),
      };
    }

    const dates = timelineItems.map((i) => new Date(i.date));
    const start = new Date(Math.min(...dates.map((d) => d.getTime())));
    const end = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Expand range to full months
    start.setDate(1);
    end.setMonth(end.getMonth() + 1);
    end.setDate(0);

    return { start, end };
  }, [timelineItems]);

  const weeks = useMemo(() => {
    const { start, end } = dateRange;
    const result: { start: Date; end: Date; items: TimelineItem[] }[] = [];

    let current = new Date(start);
    current.setDate(current.getDate() - current.getDay()); // Start on Sunday

    while (current < end) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const weekItems = timelineItems.filter((item) => {
        const itemDate = new Date(item.date);
        return itemDate >= weekStart && itemDate <= weekEnd;
      });

      result.push({ start: weekStart, end: weekEnd, items: weekItems });
      current.setDate(current.getDate() + 7);
    }

    return result;
  }, [timelineItems, dateRange]);

  const today = useMemo(() => new Date(), []);

  if (timelineItems.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-slate-500">
        <p>Sin eventos programados en la línea de tiempo</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-x-auto">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: "#3b82f6" }}></div>
          <span>Tareas</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: "#10b981" }}></div>
          <span>Proyectos</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded" style={{ backgroundColor: "#f59e0b" }}></div>
          <span>Hitos</span>
        </div>
      </div>

      {/* Timeline Grid */}
      <div className="border rounded-lg p-4 bg-white overflow-x-auto">
        <div className="min-w-min">
          <div className="flex gap-0.5 mb-4">
            {weeks.map((week, idx) => {
              const isCurrentWeek =
                today >= week.start &&
                today <= week.end;

              return (
                <div
                  key={idx}
                  className={`flex-1 min-w-32 pb-2 border-b-2 ${
                    isCurrentWeek ? "border-blue-500" : "border-slate-200"
                  }`}
                >
                  <div className="text-xs text-slate-600 font-medium mb-2">
                    {week.start.toLocaleDateString("es-ES", {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    -{" "}
                    {week.end.toLocaleDateString("es-ES", {
                      month: "short",
                      day: "numeric",
                    })}
                  </div>

                  {isCurrentWeek && (
                    <div className="text-xs text-blue-600 font-medium mb-2">
                      ← Hoy
                    </div>
                  )}

                  {/* Items in this week */}
                  <div className="space-y-1">
                    {week.items.map((item) => (
                      <div
                        key={`${item.type}-${item.id}`}
                        className="text-xs p-1 rounded text-white truncate cursor-pointer hover:opacity-80"
                        style={{ backgroundColor: item.color }}
                        title={`${item.title} (${item.type})`}
                      >
                        {item.type === "milestone" && "📌"} {item.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* List View */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Cronología</h3>
        {timelineItems.map((item, idx) => (
          <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 text-sm">
            <div
              className="w-3 h-3 rounded flex-shrink-0"
              style={{ backgroundColor: item.color }}
            ></div>
            <span className="font-medium flex-1">
              {item.type === "milestone" && "📌"} {item.title}
            </span>
            <span className="text-slate-500 text-xs">
              {new Date(item.date).toLocaleDateString("es-ES")}
            </span>
            <span className="text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-600">
              {item.type === "task"
                ? "Tarea"
                : item.type === "project"
                  ? "Proyecto"
                  : "Hito"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
