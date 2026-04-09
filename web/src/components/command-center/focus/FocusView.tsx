"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { X, CheckCircle2, ArrowRight } from "lucide-react";
import { completeTask } from "@/lib/tasks/actions";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/tasks/types";
import type { Task } from "@/lib/tasks/types";
import { PomodoroTimer } from "./PomodoroTimer";

interface FocusViewProps {
  initialTask: Task | null;
  queue: Task[];
}

export function FocusView({ initialTask, queue }: FocusViewProps) {
  const [currentTask, setCurrentTask] = useState<Task | null>(initialTask);
  const [remaining, setRemaining] = useState<Task[]>(
    queue.filter((t) => t.id !== initialTask?.id)
  );
  const [, startTransition] = useTransition();

  const advance = () => {
    const [next, ...rest] = remaining;
    setCurrentTask(next ?? null);
    setRemaining(rest);
  };

  const handleComplete = () => {
    if (!currentTask) return;
    const id = currentTask.id;
    startTransition(async () => {
      try {
        await completeTask(id);
      } catch (err) {
        console.error("completeTask failed", err);
      }
    });
    advance();
  };

  if (!currentTask) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6 px-6">
        <h1 className="text-2xl text-jarvis-cyan tracking-widest glowing-text text-center">
          Sin tareas en la cola
        </h1>
        <p className="text-sm text-jarvis-cyan/50 text-center max-w-md">
          Agrega tareas desde el tablero o usa Cmd+K para captura rápida.
        </p>
        <Link
          href="/command-center/board"
          className="glass-panel px-6 py-3 text-jarvis-cyan text-[10px] tracking-widest uppercase font-bold hover:border-jarvis-cyan/60 transition-colors"
        >
          Volver al tablero
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-12 px-6 py-12 overflow-y-auto">
      {/* Top bar */}
      <div className="absolute top-6 right-6">
        <Link
          href="/command-center/board"
          className="text-jarvis-cyan/40 hover:text-jarvis-cyan transition-colors"
          aria-label="Salir del modo foco"
        >
          <X className="w-6 h-6" />
        </Link>
      </div>

      {/* Queue indicator */}
      {remaining.length > 0 && (
        <p className="absolute top-6 left-6 text-[10px] text-jarvis-cyan/40 tracking-widest uppercase font-bold">
          {remaining.length} en cola
        </p>
      )}

      {/* Task display */}
      <div className="flex flex-col items-center gap-3 max-w-2xl text-center">
        <span
          className="text-[10px] font-bold px-2 py-1 rounded-sm tracking-widest uppercase"
          style={{
            color: PRIORITY_COLORS[currentTask.priority],
            backgroundColor: `${PRIORITY_COLORS[currentTask.priority]}15`,
            border: `1px solid ${PRIORITY_COLORS[currentTask.priority]}40`,
          }}
        >
          {PRIORITY_LABELS[currentTask.priority]}
        </span>

        <h1 className="text-3xl md:text-4xl text-white font-bold leading-tight">
          {currentTask.title}
        </h1>

        {currentTask.description && (
          <p className="text-sm text-white/60 leading-relaxed max-w-lg">
            {currentTask.description}
          </p>
        )}
      </div>

      {/* Timer */}
      <PomodoroTimer taskId={currentTask.id} />

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleComplete}
          className="glass-panel px-6 py-3 flex items-center gap-2 text-[#10b981] hover:border-[#10b981]/60 transition-colors"
          aria-label="Completar tarea"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-[10px] tracking-widest uppercase font-bold">
            Completar tarea
          </span>
        </button>

        {remaining.length > 0 && (
          <button
            type="button"
            onClick={advance}
            className="glass-panel px-6 py-3 flex items-center gap-2 text-jarvis-cyan/60 hover:text-jarvis-cyan transition-colors"
            aria-label="Siguiente tarea"
          >
            <ArrowRight className="w-4 h-4" />
            <span className="text-[10px] tracking-widest uppercase font-bold">
              Siguiente
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
