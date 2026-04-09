"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/cn";
import { STATUS_LABELS } from "@/lib/tasks/types";
import type { Task, TaskStatus, Workspace } from "@/lib/tasks/types";
import { TaskCard } from "./TaskCard";

const STATUS_ACCENT: Record<TaskStatus, string> = {
  backlog: "var(--text-mute)",
  in_progress: "var(--accent)",
  review: "#a855f7",
  done: "var(--success)",
};

interface ColumnProps {
  status: TaskStatus;
  tasks: Task[];
  workspaces: Workspace[];
  onOpenTask: (task: Task) => void;
}

export function Column({ status, tasks, workspaces, onOpenTask }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const color = STATUS_ACCENT[status];

  return (
    <div
      className={cn(
        "flex flex-col min-w-[280px] md:min-w-[300px] flex-shrink-0",
        "rounded-[var(--radius-md)] bg-[color:var(--surface-solid)] border border-[color:var(--border)]",
        "transition-all duration-200",
        isOver && "border-[color:var(--accent)]/40"
      )}
      style={{ borderTopColor: color, borderTopWidth: 2 }}
      aria-label={`Columna ${STATUS_LABELS[status]}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-[color:var(--border)]">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <span
          className="text-[10px] font-semibold tracking-widest uppercase"
          style={{ color }}
        >
          {STATUS_LABELS[status]}
        </span>
        <span className="ml-auto text-[10px] text-[color:var(--text-mute)] font-medium">
          {tasks.length}
        </span>
      </div>

      {/* Cards area */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 flex flex-col gap-2 p-2 overflow-y-auto scroll-minimal min-h-[200px] transition-colors",
          isOver && "bg-[color:var(--accent)]/5"
        )}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              workspace={workspaces.find((w) => w.id === task.workspace_id)}
              onOpen={onOpenTask}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[9px] text-[color:var(--text-mute)] tracking-widest uppercase">
              Sin tareas
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
