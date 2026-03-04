"use client";

import { useState } from "react";
import { ObjectiveArea } from "@/db/schema";
import { Trash2, X } from "lucide-react";

const PRESET_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
];

const PRESET_EMOJIS = ["💰", "📊", "🎯", "🗺️", "📦", "🚀", "💡", "🏆"];

interface ObjectiveAreasManagerProps {
  areas: ObjectiveArea[];
  objectiveId: string;
  onAreaAdded: (area: ObjectiveArea) => void;
  onAreaUpdated: (area: ObjectiveArea) => void;
  onAreaDeleted: (areaId: string) => void;
}

export function ObjectiveAreasManager({
  areas,
  objectiveId,
  onAreaAdded,
  onAreaUpdated,
  onAreaDeleted,
}: ObjectiveAreasManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", color: "#3b82f6", emoji: "" });
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setLoading(true);
    try {
      const method = editingId ? "PATCH" : "POST";
      const url = editingId
        ? `/api/objectives/${objectiveId}/areas/${editingId}`
        : `/api/objectives/${objectiveId}/areas`;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save area");

      const area = await response.json();
      if (editingId) {
        onAreaUpdated(area);
        setEditingId(null);
      } else {
        onAreaAdded(area);
      }
      setFormData({ name: "", color: "#3b82f6", emoji: "" });
      setShowForm(false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (areaId: string) => {
    if (!confirm("¿Eliminar esta área?")) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/objectives/${objectiveId}/areas/${areaId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete area");
      onAreaDeleted(areaId);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (area: ObjectiveArea) => {
    setFormData({ name: area.name, color: area.color || "#3b82f6", emoji: area.emoji || "" });
    setEditingId(area.id);
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      {/* Areas List */}
      {areas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {areas.map((area) => (
            <div
              key={area.id}
              className="flex items-center gap-2 px-3 py-1 rounded-full text-sm text-white"
              style={{ backgroundColor: area.color }}
            >
              {area.emoji && <span>{area.emoji}</span>}
              <span>{area.name}</span>
              <div className="flex items-center gap-1 ml-1">
                <button
                  onClick={() => startEdit(area)}
                  className="opacity-75 hover:opacity-100 transition-opacity"
                  aria-label="Edit area"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(area.id)}
                  className="opacity-75 hover:opacity-100 transition-opacity"
                  aria-label="Delete area"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="border rounded-lg p-4 bg-slate-50">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nombre</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-2 py-1 border rounded text-sm"
                placeholder="Ej: Financiero"
                maxLength={100}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Color</label>
                <div className="flex gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 ${
                        formData.color === color ? "border-black" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, color })}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Emoji</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(showEmojiPicker ? null : "emoji")}
                    className="w-full px-2 py-1 border rounded text-sm text-left"
                  >
                    {formData.emoji || "Seleccionar..."}
                  </button>
                  {showEmojiPicker === "emoji" && (
                    <div className="absolute top-full left-0 mt-1 p-2 border rounded bg-white shadow-lg z-10 grid grid-cols-4 gap-1">
                      {PRESET_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="text-xl hover:bg-slate-100 p-1 rounded"
                          onClick={() => {
                            setFormData({ ...formData, emoji });
                            setShowEmojiPicker(null);
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || !formData.name.trim()}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {editingId ? "Actualizar" : "Crear"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setFormData({ name: "", color: "#3b82f6", emoji: "" });
                }}
                className="px-3 py-1 border rounded text-sm hover:bg-slate-100"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="px-3 py-1 text-sm border rounded hover:bg-slate-50"
        >
          + Agregar área
        </button>
      )}
    </div>
  );
}
