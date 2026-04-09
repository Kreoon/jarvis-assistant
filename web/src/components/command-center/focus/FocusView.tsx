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
      <div className="fixed inset-0 bg-[color:var(--bg)] flex flex-col items-center justify-center gap-6 px-6">
        <h1 className="text-2xl text-[color:var(--text)] font-semibold tracking-tight text-center">
          Sin tareas en la cola
        </h1>
        <p className="text-sm text-[color:var(--text-dim)] text-center max-w-md">
          Agrega tareas desde el tablero o usa Cmd+K para captura rápida.
        </p>
        <Link
          href="/tasks"
          className="rounded-[var(--radius-md)] px-6 py-3 text-[color:var(--accent)] text-sm font-medium border border-[color:var(--accent)]/30 hover:border-[color:var(--accent)]/60 hover:bg-[color:var(--accent)]/10 transition-colors"
        >
          Volver al tablero
        </Link>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[color:var(--bg)] flex flex-col items-center justify-center gap-12 px-6 py-12 overflow-y-auto">
      {/* Top bar */}
      <div className="absolute top-6 right-6">
        <Link
          href="/tasks"
          className="text-[color:var(--text-mute)] hover:text-[color:var(--text)] transition-colors"
          aria-label="Salir del modo foco"
        >
          <X className="w-6 h-6" />
        </Link>
      </div>

      {/* Queue indicator */}
      {remaining.length > 0 && (
        <p className="absolute top-6 left-6 text-[10px] text-[color:var(--text-mute)] tracking-widest uppercase font-medium">
          {remaining.length} en cola
        </p>
      )}

      {/* Task display */}
      <div className="flex flex-col items-center gap-3 max-w-2xl text-center">
        <span
          className="text-[10px] font-semibold px-2 py-1 rounded-sm tracking-widest uppercase"
          style={{
            color: PRIORITY_COLORS[currentTask.priority],
            backgroundColor: `${PRIORITY_COLORS[currentTask.priority]}15`,
            border: `1px solid ${PRIORITY_COLORS[currentTask.priority]}40`,
          }}
        >
          {PRIORITY_LABELS[currentTask.priority]}
        </span>

        <h1 className="text-3xl md:text-4xl text-[color:var(--text)] font-bold leading-tight tracking-tight">
          {currentTask.title}
        </h1>

        {currentTask.description && (
          <p className="text-sm text-[color:var(--text-dim)] leading-relaxed max-w-lg">
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
          className="rounded-[var(--radius-md)] px-6 py-3 flex items-center gap-2 text-[color:var(--success)] border border-[color:var(--success)]/40 hover:bg-[color:var(--success)]/10 hover:border-[color:var(--success)]/60 transition-colors"
          aria-label="Completar tarea"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-[10px] tracking-widest uppercase font-semibold">
            Completar tarea
          </span>
        </button>

        {remaining.length > 0 && (
          <button
            type="button"
            onClick={advance}
            className="rounded-[var(--radius-md)] px-6 py-3 flex items-center gap-2 text-[color:var(--text-dim)] border border-[color:var(--border)] hover:text-[color:var(--text)] hover:border-[color:var(--border-strong)] transition-colors"
            aria-label="Siguiente tarea"
          >
            <ArrowRight className="w-4 h-4" />
            <span className="text-[10px] tracking-widest uppercase font-semibold">
              Siguiente
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
