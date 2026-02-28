"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

export function CtaFinal() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#1e3a5f]">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-white/80 text-sm mb-6">
            <Sparkles className="w-4 h-4" />
            Gratis para siempre en el plan básico
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Lleva tu gestión al siguiente nivel
          </h2>
          <p className="text-white/70 text-lg mb-8 max-w-2xl mx-auto">
            Únete a cientos de profesionales y empresas que ya usan Uxuri para
            administrar sus negocios con eficiencia.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 bg-white text-[#1e3a5f] px-8 py-4 rounded-xl font-semibold hover:bg-slate-100 transition-colors text-lg"
            >
              Comenzar gratis ahora
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
