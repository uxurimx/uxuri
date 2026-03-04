"use client";

import { useState, useMemo } from "react";
import { ObjectiveArea } from "@/db/schema";
import { Trash2 } from "lucide-react";

interface LinkedItem {
  linkId: string;
  areaId?: string;
  id: string;
  title?: string;
  name?: string;
  status?: string;
}

interface ObjectiveAreas {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
}

interface ObjectiveLinksProps {
  objectiveId: string;
  areas: ObjectiveAreas[];
  linkedTasks: LinkedItem[];
  linkedProjects: LinkedItem[];
  onLinkAdded: () => void;
  onLinkRemoved: () => void;
}

export function ObjectiveLinksPanel({
  objectiveId,
  areas,
  linkedTasks,
  linkedProjects,
  onLinkAdded,
  onLinkRemoved,
}: ObjectiveLinksProps) {
  const [linkType, setLinkType] = useState<"task" | "project">("task");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const allLinked = useMemo(() => {
    const ids = new Set([...linkedTasks.map((t) => t.id), ...linkedProjects.map((p) => p.id)]);
    return ids;
  }, [linkedTasks, linkedProjects]);

  // Load all items when type changes
  const loadItems = async (type: "task" | "project") => {
    setLoading(true);
    try {
      const endpoint = type === "task" ? "/api/tasks" : "/api/projects";
      const res = await fetch(endpoint);
      if (!res.ok) return;
      const data = await res.json();
      if (type === "task") setAllTasks(Array.isArray(data) ? data : []);
      else setAllProjects(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const searchResults = useMemo(() => {
    const pool = linkType === "task" ? allTasks : allProjects;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return pool
      .filter((item) => {
        const name = (item.title || item.name || "").toLowerCase();
        return name.includes(q) && !allLinked.has(item.id);
      })
      .slice(0, 10);
  }, [searchQuery, linkType, allTasks, allProjects, allLinked]);

  const handleLink = async (itemId: string) => {
    try {
      const response = await fetch(`/api/objectives/${objectiveId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: linkType,
          id: itemId,
          areaId: selectedAreaId || undefined,
        }),
      });

      if (!response.ok) {
        if (response.status === 409) {
          alert("Este ítem ya está vinculado");
          return;
        }
        throw new Error("Failed to link");
      }

      onLinkAdded();
      setSearchQuery("");
      setSelectedAreaId("");
    } catch (error) {
      console.error(error);
    }
  };

  const handleUnlink = async (linkId: string) => {
    try {
      const response = await fetch(`/api/objectives/${objectiveId}/links`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: linkType,
          linkId,
        }),
      });

      if (!response.ok) throw new Error("Failed to unlink");
      onLinkRemoved();
    } catch (error) {
      console.error(error);
    }
  };

  const displayItems = linkType === "task" ? linkedTasks : linkedProjects;
  const groupedByArea = useMemo(() => {
    const groups: { [key: string]: LinkedItem[] } = {};
    displayItems.forEach((item) => {
      const key = item.areaId || "sin-area";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [displayItems]);

  return (
    <div className="space-y-4">
      {/* Link Form */}
      <div className="border rounded-lg p-4 bg-slate-50">
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => {
              setLinkType("task");
              setSearchQuery("");
              loadItems("task");
            }}
            className={`px-3 py-1 text-sm rounded ${
              linkType === "task"
                ? "bg-blue-600 text-white"
                : "border hover:bg-white"
            }`}
          >
            Tareas
          </button>
          <button
            onClick={() => {
              setLinkType("project");
              setSearchQuery("");
              loadItems("project");
            }}
            className={`px-3 py-1 text-sm rounded ${
              linkType === "project"
                ? "bg-blue-600 text-white"
                : "border hover:bg-white"
            }`}
          >
            Proyectos
          </button>
        </div>

        <div className="space-y-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              if (e.target.value && (linkType === "task" ? allTasks : allProjects).length === 0) {
                loadItems(linkType);
              }
              setSearchQuery(e.target.value);
            }}
            placeholder={`Buscar ${linkType === "task" ? "tareas" : "proyectos"}...`}
            className="w-full px-2 py-1 border rounded text-sm"
          />

          {searchResults.length > 0 && (
            <div className="border rounded bg-white max-h-48 overflow-y-auto">
              {searchResults.map((item) => (
                <div
                  key={item.id}
                  className="p-2 border-b last:border-b-0 hover:bg-slate-50 flex justify-between items-center"
                >
                  <div>
                    <p className="text-sm font-medium">{item.title || item.name}</p>
                    {item.status && <p className="text-xs text-slate-500">{item.status}</p>}
                  </div>
                  <button
                    onClick={() => handleLink(item.id)}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Vincular
                  </button>
                </div>
              ))}
            </div>
          )}

          {searchQuery && searchResults.length === 0 && !loading && (
            <p className="text-xs text-slate-500">Sin resultados</p>
          )}

          {/* Area selector */}
          {searchResults.length > 0 && (
            <select
              value={selectedAreaId}
              onChange={(e) => setSelectedAreaId(e.target.value)}
              className="w-full px-2 py-1 border rounded text-sm"
            >
              <option value="">Sin área</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.emoji} {area.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Grouped Links */}
      <div className="space-y-4">
        {Object.entries(groupedByArea).map(([groupKey, items]) => {
          const area = groupKey !== "sin-area" ? areas.find((a) => a.id === groupKey) : null;
          return (
            <div key={groupKey}>
              <div className="flex items-center gap-2 mb-2">
                {area && (
                  <span className="px-2 py-1 rounded text-xs text-white" style={{ backgroundColor: area.color }}>
                    {area.emoji} {area.name}
                  </span>
                )}
                {groupKey === "sin-area" && (
                  <span className="text-xs text-slate-500">Sin área</span>
                )}
              </div>

              <div className="space-y-1 ml-2">
                {items.map((item) => (
                  <div
                    key={item.linkId}
                    className="flex justify-between items-center p-2 border rounded text-sm hover:bg-slate-50"
                  >
                    <span>{item.title || item.name}</span>
                    <button
                      onClick={() => handleUnlink(item.linkId)}
                      className="p-1 hover:bg-red-100 rounded"
                      aria-label="Unlink"
                    >
                      <Trash2 size={14} className="text-red-600" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {displayItems.length === 0 && (
          <p className="text-sm text-slate-500">Sin {linkType === "task" ? "tareas" : "proyectos"} vinculadas</p>
        )}
      </div>
    </div>
  );
}
