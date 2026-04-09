"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { parseISO, isToday, isTomorrow, isThisWeek } from "date-fns";
import { completeTask } from "@/lib/tasks/actions";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/tasks/types";
import type { Task, TaskPriority, Workspace } from "@/lib/tasks/types";
import { cn } from "@/lib/cn";

interface TaskListProps {
  tasks: Task[];
  workspaces: Workspace[];
}

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

type Bucket = "Hoy" | "Mañana" | "Esta semana" | "Más adelante" | "Sin fecha";

function bucketFor(task: Task): Bucket {
  if (!task.due_date) return "Sin fecha";
  const d = parseISO(task.due_date);
  if (isToday(d)) return "Hoy";
  if (isTomorrow(d)) return "Mañana";
  if (isThisWeek(d, { weekStartsOn: 1 })) return "Esta semana";
  return "Más adelante";
}

const BUCKET_ORDER: Bucket[] = [
  "Hoy",
  "Mañana",
  "Esta semana",
  "Más adelante",
  "Sin fecha",
];

export function TaskList({ tasks: initial, workspaces }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>(initial);
  const [, startTransition] = useTransition();

  const sorted = [...tasks]
    .filter((t) => t.status !== "done")
    .sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority];
      const pb = PRIORITY_ORDER[b.priority];
      if (pa !== pb) return pa - pb;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return a.workspace_id.localeCompare(b.workspace_id);
    });

  const grouped = new Map<Bucket, Task[]>();
  for (const b of BUCKET_ORDER) grouped.set(b, []);
  for (const t of sorted) grouped.get(bucketFor(t))!.push(t);

  const handleComplete = (id: string) => {
    setTasks((curr) =>
      curr.map((t) =>
        t.id === id ? { ...t, status: "done", completed_at: new Date().toISOString() } : t
      )
    );
    startTransition(async () => {
      try {
        await completeTask(id);
      } catch (err) {
        console.error("completeTask failed", err);
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {BUCKET_ORDER.map((bucket) => {
        const items = grouped.get(bucket) ?? [];
        if (items.length === 0) return null;
        return (
          <section key={bucket} aria-labelledby={`bucket-${bucket}`}>
            <h2
              id={`bucket-${bucket}`}
              className="text-[10px] text-jarvis-cyan/60 tracking-[0.3em] uppercase font-bold mb-2"
            >
              {bucket} · {items.length}
            </h2>
            <ul className="flex flex-col gap-1.5">
              {items.map((task) => {
                const ws = workspaces.find((w) => w.id === task.workspace_id);
                return (
                  <li
                    key={task.id}
                    className="glass-panel px-3 py-2.5 flex items-center gap-3 group hover:border-jarvis-cyan/40 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => handleComplete(task.id)}
                      className="text-jarvis-cyan/40 hover:text-[#10b981] transition-colors"
                      aria-label={`Completar ${task.title}`}
                    >
                      <Circle className="w-4 h-4 group-hover:hidden" />
                      <CheckCircle2 className="w-4 h-4 hidden group-hover:block" />
                    </button>

                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: PRIORITY_COLORS[task.priority],
                        boxShadow: `0 0 6px ${PRIORITY_COLORS[task.priority]}`,
                      }}
                      aria-label={`Prioridad ${PRIORITY_LABELS[task.priority]}`}
                    />

                    <span className="flex-1 text-xs text-white/85 truncate">
                      {task.title}
                    </span>

                    {ws && (
                      <span
                        className="text-[9px] px-1.5 py-0.5 rounded-sm tracking-widest uppercase"
                        style={{
                          color: ws.color,
                          backgroundColor: `${ws.color}15`,
                          border: `1px solid ${ws.color}30`,
                        }}
                      >
                        {ws.name}
                      </span>
                    )}

                    {task.due_date && (
                      <span
                        className={cn(
                          "text-[9px] text-jarvis-cyan/40 tracking-wide",
                          isToday(parseISO(task.due_date)) && "text-[#ef4444]"
                        )}
                      >
                        {task.due_date.split("T")[0]}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {sorted.length === 0 && (
        <p className="text-[10px] text-jarvis-cyan/30 tracking-widest uppercase text-center py-12">
          Sin tareas pendientes
        </p>
      )}
    </div>
  );
}
