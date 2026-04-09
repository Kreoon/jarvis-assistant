"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import type { Task } from "@/lib/tasks/types";

interface ActivityChartProps {
  tasks: Task[];
}

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function ActivityChart({ tasks }: ActivityChartProps) {
  const data = useMemo(() => {
    const now = new Date();
    const days: { date: Date; label: string; count: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      days.push({ date: d, label: DAY_LABELS[d.getDay()], count: 0 });
    }

    for (const task of tasks) {
      if (!task.completed_at) continue;
      const c = new Date(task.completed_at);
      c.setHours(0, 0, 0, 0);
      const bucket = days.find((d) => d.date.getTime() === c.getTime());
      if (bucket) bucket.count++;
    }

    return days;
  }, [tasks]);

  const max = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="glass-panel p-4">
      <div className="hud-border hud-tl" />
      <div className="hud-border hud-br" />

      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-[10px] text-jarvis-cyan/60 tracking-[0.3em] uppercase font-bold">
          Actividad · 7 días
        </h3>
        <span className="text-[9px] text-jarvis-cyan/40 tracking-wider">
          {total} completadas
        </span>
      </div>

      <div
        className="flex items-end justify-between gap-2 h-32"
        role="img"
        aria-label={`Gráfico de ${total} tareas completadas en los últimos 7 días`}
      >
        {data.map((d, i) => {
          const pct = (d.count / max) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="relative w-full flex-1 flex items-end">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${pct}%` }}
                  transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
                  className="w-full rounded-t-sm"
                  style={{
                    background: "linear-gradient(180deg, #00e5ff 0%, rgba(0,229,255,0.2) 100%)",
                    boxShadow: d.count > 0 ? "0 0 10px rgba(0,229,255,0.3)" : undefined,
                    minHeight: d.count > 0 ? 4 : 0,
                  }}
                />
                {d.count > 0 && (
                  <span className="absolute -top-4 left-0 right-0 text-center text-[9px] text-jarvis-cyan font-bold">
                    {d.count}
                  </span>
                )}
              </div>
              <span className="text-[9px] text-jarvis-cyan/40 tracking-widest uppercase">
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
