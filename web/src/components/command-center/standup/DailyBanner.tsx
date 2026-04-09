"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { setDailyFocus } from "@/lib/tasks/actions";
import { PRIORITY_COLORS } from "@/lib/tasks/types";
import type { Task, DailyFocus } from "@/lib/tasks/types";

interface DailyBannerProps {
  todayTasks: Task[];
  existingFocus: DailyFocus | null;
}

export function DailyBanner({ todayTasks, existingFocus }: DailyBannerProps) {
  const [dismissed, setDismissed] = useState(existingFocus !== null);

  if (dismissed) return null;

  const urgentCount = todayTasks.filter((t) => t.priority === "urgent").length;
  const today = new Date().toISOString().split("T")[0];
  const deadlineToday = todayTasks.filter((t) => t.due_date === today).length;
  const top3 = todayTasks.slice(0, 3);

  const handleDismiss = async () => {
    setDismissed(true);
    // Guardar daily_focus vacío para hoy — marca como visto
    await setDailyFocus(top3.map((t) => t.id));
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 18) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="glass-panel border-l-2 border-l-jarvis-cyan mb-4 p-4"
        role="banner"
        aria-label="Resumen del día"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Saludo */}
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-jarvis-cyan flex-shrink-0" aria-hidden="true" />
              <p className="text-xs text-jarvis-cyan tracking-widest font-bold">
                {greeting()}, Alexander.
              </p>
            </div>

            {/* Stats */}
            <p className="text-[11px] text-jarvis-cyan/60 mb-3">
              {urgentCount > 0 && (
                <span className="text-[#ef4444]">
                  {urgentCount} {urgentCount === 1 ? "tarea urgente" : "tareas urgentes"}
                </span>
              )}
              {urgentCount > 0 && deadlineToday > 0 && (
                <span className="text-jarvis-cyan/40"> · </span>
              )}
              {deadlineToday > 0 && (
                <span className="text-[#f97316]">
                  {deadlineToday} con deadline hoy
                </span>
              )}
              {urgentCount === 0 && deadlineToday === 0 && (
                <span>Sin urgencias para hoy. Buen momento para avanzar en backlog.</span>
              )}
            </p>

            {/* Top 3 tareas */}
            {top3.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {top3.map((task, i) => (
                  <div key={task.id} className="flex items-center gap-2">
                    <span className="text-[9px] text-jarvis-cyan/30 w-4 flex-shrink-0">
                      {i + 1}.
                    </span>
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PRIORITY_COLORS[task.priority] }}
                      aria-label={`Prioridad ${task.priority}`}
                    />
                    <span className="text-[11px] text-white/80 truncate">{task.title}</span>
                    {task.due_date === today && (
                      <span className="flex items-center gap-0.5 text-[9px] text-[#ef4444] flex-shrink-0">
                        <Clock className="w-2.5 h-2.5" />
                        HOY
                      </span>
                    )}
                    <Link
                      href={`/command-center/focus?task=${task.id}`}
                      className="ml-auto text-[9px] text-jarvis-cyan/50 hover:text-jarvis-cyan tracking-widest transition-colors whitespace-nowrap flex-shrink-0"
                    >
                      EMPEZAR →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botón cerrar */}
          <button
            onClick={handleDismiss}
            aria-label="Cerrar banner del día"
            className="text-jarvis-cyan/30 hover:text-jarvis-cyan transition-colors flex-shrink-0 mt-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
