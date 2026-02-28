"use client";

import { motion } from "framer-motion";
import {
  Users,
  Briefcase,
  CheckSquare,
  Clock,
  Calendar,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Gestión de Clientes",
    description:
      "Centraliza toda la información de tus clientes: contactos, historial y estado en un solo lugar.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: Briefcase,
    title: "Proyectos",
    description:
      "Organiza proyectos con prioridades, fechas y estados. Vincula clientes a cada iniciativa.",
    color: "bg-indigo-50 text-indigo-600",
  },
  {
    icon: CheckSquare,
    title: "Tareas Kanban",
    description:
      "Tablero kanban multi-proyecto con drag & drop. Arrastra tareas entre columnas en tiempo real.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: Clock,
    title: "Tiempo Real",
    description:
      "Actualizaciones instantáneas vía Pusher. Ve los cambios de tu equipo sin recargar la página.",
    color: "bg-amber-50 text-amber-600",
  },
  {
    icon: Calendar,
    title: "Agenda y Fechas",
    description:
      "Control de fechas de inicio y vencimiento con alertas visuales para no perder ningún deadline.",
    color: "bg-rose-50 text-rose-600",
  },
  {
    icon: Zap,
    title: "Flujos de Trabajo",
    description:
      "Sistema de roles (admin, manager, client) con permisos granulares para cada sección.",
    color: "bg-purple-50 text-purple-600",
  },
];

export function Features() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Todo lo que necesitas,{" "}
            <span className="text-[#1e3a5f]">en un solo lugar</span>
          </h2>
          <p className="mt-4 text-slate-500 max-w-2xl mx-auto">
            Uxuri reúne las herramientas esenciales para gestionar tu negocio
            sin fricciones.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="p-6 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all"
            >
              <div className={`inline-flex p-3 rounded-xl ${feature.color} mb-4`}>
                <feature.icon className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
