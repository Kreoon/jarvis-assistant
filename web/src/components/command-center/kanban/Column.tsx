"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/cn";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/tasks/types";
import type { Task, TaskStatus, Workspace } from "@/lib/tasks/types";
import { TaskCard } from "./TaskCard";

interface ColumnProps {
  status: TaskStatus;
  tasks: Task[];
  workspaces: Workspace[];
  onOpenTask: (task: Task) => void;
}

export function Column({ status, tasks, workspaces, onOpenTask }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const color = STATUS_COLORS[status];

  return (
    <div
      className={cn(
        "flex flex-col min-w-[280px] md:min-w-[300px] flex-shrink-0 glass-panel transition-all duration-200",
        isOver && "border-jarvis-cyan/50 shadow-[0_0_25px_rgba(0,229,255,0.2)]"
      )}
      style={{ borderTopColor: color, borderTopWidth: 2 }}
      aria-label={`Columna ${STATUS_LABELS[status]}`}
    >
      <div className="hud-border hud-tl" style={{ borderColor: color }} />
      <div className="hud-border hud-tr" style={{ borderColor: color }} />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-jarvis-cyan/10">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
          aria-hidden="true"
        />
        <span
          className="text-[10px] font-bold tracking-widest uppercase"
          style={{ color }}
        >
          {STATUS_LABELS[status]}
        </span>
        <span className="ml-auto text-[10px] text-jarvis-cyan/30 font-bold">
          {tasks.length}
        </span>
      </div>

      {/* Cards area */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 flex flex-col gap-2 p-2 overflow-y-auto custom-scrollbar min-h-[200px] transition-colors",
          isOver && "bg-jarvis-cyan/5"
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
            <p className="text-[9px] text-jarvis-cyan/15 tracking-widest uppercase">
              Sin tareas
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
