"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, Users, CheckSquare } from "lucide-react";

export function Hero() {
  return (
    <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          {/* Text content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="flex-1 text-center lg:text-left"
          >
            <span className="inline-block px-3 py-1 text-xs font-semibold bg-blue-50 text-[#1e3a5f] rounded-full mb-4">
              Sistema de gestión profesional
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight">
              Gestiona tu negocio{" "}
              <span className="text-[#1e3a5f]">con claridad total</span>
            </h1>
            <p className="mt-6 text-lg text-slate-500 max-w-2xl">
              Uxuri centraliza tus clientes, proyectos y tareas en un solo
              lugar. Colabora en tiempo real, controla el avance y toma
              decisiones basadas en datos.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 bg-[#1e3a5f] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#162d4a] transition-colors"
              >
                Comenzar gratis
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center gap-2 border border-slate-200 text-slate-700 px-6 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
              >
                Ver demo
              </Link>
            </div>
          </motion.div>

          {/* Dashboard mockup */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex-1 w-full max-w-2xl"
          >
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
              {/* Mockup topbar */}
              <div className="bg-[#1e3a5f] px-4 py-3 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-3 text-white/60 text-xs">
                  app.uxuri.com/dashboard
                </span>
              </div>

              <div className="flex h-64">
                {/* Sidebar mockup */}
                <div className="w-16 bg-slate-900 py-4 flex flex-col items-center gap-4">
                  {[BarChart3, Users, CheckSquare].map((Icon, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded-lg ${i === 0 ? "bg-[#1e3a5f]" : ""}`}
                    >
                      <Icon className="w-4 h-4 text-slate-400" />
                    </div>
                  ))}
                </div>

                {/* Content mockup */}
                <div className="flex-1 p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Clientes", val: "24", color: "bg-blue-50" },
                      { label: "Proyectos", val: "12", color: "bg-indigo-50" },
                      { label: "Tareas", val: "47", color: "bg-emerald-50" },
                    ].map((card) => (
                      <div
                        key={card.label}
                        className={`${card.color} p-2 rounded-lg`}
                      >
                        <p className="text-xs text-slate-500">{card.label}</p>
                        <p className="text-lg font-bold text-slate-800">
                          {card.val}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                    {["Diseño UI · Alta", "Backend API · Media", "Testing · Baja"].map(
                      (task, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2"
                        >
                          <div className="w-2 h-2 rounded-full bg-[#1e3a5f]" />
                          <span className="text-xs text-slate-600">{task}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
