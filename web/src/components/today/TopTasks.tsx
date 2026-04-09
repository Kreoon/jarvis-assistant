"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Circle, CheckCircle2 } from "lucide-react";
import { completeTask } from "@/lib/tasks/actions";
import { PRIORITY_COLORS } from "@/lib/tasks/types";
import type { Task } from "@/lib/tasks/types";
import { cn } from "@/lib/cn";

export function TopTasks({ tasks }: { tasks: Task[] }) {
  const [localTasks, setLocalTasks] = useState(tasks);
  const [, startTransition] = useTransition();

  const handleComplete = (id: string) => {
    setLocalTasks((ts) => ts.filter((t) => t.id !== id));
    startTransition(async () => {
      try {
        await completeTask(id);
      } catch (err) {
        console.error("completeTask failed", err);
      }
    });
  };

  if (localTasks.length === 0) {
    return (
      <p className="text-sm text-[color:var(--text-mute)]">
        Sin tareas urgentes. Disfruta el día.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {localTasks.slice(0, 3).map((t) => (
        <li
          key={t.id}
          className="group flex items-center gap-3 px-3 py-3 rounded-[var(--radius-md)] hover:bg-[color:var(--surface-solid)] transition-colors"
        >
          <button
            type="button"
            onClick={() => handleComplete(t.id)}
            className="text-[color:var(--text-mute)] hover:text-[color:var(--success)] transition-colors"
            aria-label={`Completar ${t.title}`}
          >
            <Circle className="w-5 h-5 group-hover:hidden" />
            <CheckCircle2 className="w-5 h-5 hidden group-hover:block" />
          </button>
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: PRIORITY_COLORS[t.priority] }}
            aria-hidden="true"
          />
          <Link
            href="/tasks"
            className="flex-1 text-[15px] text-[color:var(--text)] truncate"
          >
            {t.title}
          </Link>
          {t.due_date && (
            <span className="text-xs text-[color:var(--text-mute)]">
              {new Date(t.due_date).toLocaleDateString("es-CO", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
