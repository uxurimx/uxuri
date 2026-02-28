"use client";

import { motion } from "framer-motion";
import { UserPlus, Settings, TrendingUp } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    step: "01",
    title: "Crea tu cuenta",
    description:
      "Regístrate en segundos con tu email. Sin tarjeta de crédito. Empieza gratis.",
  },
  {
    icon: Settings,
    step: "02",
    title: "Configura tu espacio",
    description:
      "Agrega clientes, crea proyectos y define tareas. Invita a tu equipo y asigna roles.",
  },
  {
    icon: TrendingUp,
    step: "03",
    title: "Trabaja y crece",
    description:
      "Monitorea el avance en tiempo real. Toma decisiones inteligentes con el dashboard.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
            ¿Cómo funciona?
          </h2>
          <p className="mt-4 text-slate-500 max-w-xl mx-auto">
            Empieza a gestionar tu negocio en 3 simples pasos
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.15 }}
              className="relative flex flex-col items-center text-center"
            >
              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-px bg-slate-200" />
              )}

              <div className="relative w-20 h-20 rounded-2xl bg-[#1e3a5f] flex items-center justify-center mb-6 shadow-lg">
                <step.icon className="w-8 h-8 text-white" />
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border-2 border-[#1e3a5f] flex items-center justify-center text-[10px] font-bold text-[#1e3a5f]">
                  {step.step}
                </span>
              </div>

              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                {step.title}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
