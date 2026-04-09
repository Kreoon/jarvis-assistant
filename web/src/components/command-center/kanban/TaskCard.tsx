"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Clock, Tag } from "lucide-react";
import { formatDistanceToNow, isToday, isTomorrow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/cn";
import { PRIORITY_COLORS, PRIORITY_LABELS } from "@/lib/tasks/types";
import type { Task, Workspace } from "@/lib/tasks/types";

interface TaskCardProps {
  task: Task;
  workspace: Workspace | undefined;
  onOpen: (task: Task) => void;
}

function formatDueDate(dateStr: string): { label: string; urgent: boolean } {
  const date = parseISO(dateStr);
  if (isToday(date)) return { label: "Hoy", urgent: true };
  if (isTomorrow(date)) return { label: "Mañana", urgent: false };
  return {
    label: formatDistanceToNow(date, { addSuffix: true, locale: es }),
    urgent: date < new Date(),
  };
}

export function TaskCard({ task, workspace, onOpen }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dueInfo = task.due_date ? formatDueDate(task.due_date) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "glass-panel p-3 cursor-pointer transition-all duration-200 group",
        "hover:border-jarvis-cyan/40 hover:shadow-[0_0_20px_rgba(0,229,255,0.15)]",
        isDragging && "opacity-40 scale-95"
      )}
      onClick={() => onOpen(task)}
      role="button"
      tabIndex={0}
      aria-label={`Tarea: ${task.title}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(task);
        }
      }}
    >
      <div className="hud-border hud-tl" />
      <div className="hud-border hud-br" />

      {/* Top row: drag handle + prioridad */}
      <div className="flex items-center gap-2 mb-2">
        <button
          {...attributes}
          {...listeners}
          className="text-jarvis-cyan/20 hover:text-jarvis-cyan/60 transition-colors cursor-grab active:cursor-grabbing flex-shrink-0"
          aria-label="Arrastrar para reordenar"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>

        {/* Badge prioridad */}
        <span
          className="text-[8px] font-bold px-1.5 py-0.5 rounded-sm tracking-widest flex-shrink-0"
          style={{
            color: PRIORITY_COLORS[task.priority],
            borderColor: `${PRIORITY_COLORS[task.priority]}40`,
            backgroundColor: `${PRIORITY_COLORS[task.priority]}10`,
            border: "1px solid",
          }}
        >
          {PRIORITY_LABELS[task.priority].toUpperCase()}
        </span>

        {/* Badge workspace */}
        {workspace && (
          <span
            className="text-[8px] px-1.5 py-0.5 rounded-sm tracking-widest ml-auto flex-shrink-0 truncate max-w-[80px]"
            style={{
              color: workspace.color,
              backgroundColor: `${workspace.color}15`,
              border: `1px solid ${workspace.color}30`,
            }}
            title={workspace.name}
          >
            {workspace.name.toUpperCase()}
          </span>
        )}
      </div>

      {/* Título */}
      <p className="text-xs text-white/85 leading-relaxed mb-2 line-clamp-2">
        {task.title}
      </p>

      {/* Bottom row: due date + pomodoros */}
      <div className="flex items-center gap-3 mt-2">
        {dueInfo && (
          <span
            className={cn(
              "flex items-center gap-1 text-[9px] tracking-wide",
              dueInfo.urgent ? "text-[#ef4444]" : "text-jarvis-cyan/40"
            )}
          >
            <Clock className="w-2.5 h-2.5" aria-hidden="true" />
            {dueInfo.label}
          </span>
        )}

        {task.pomodoros_completed > 0 && (
          <span className="flex items-center gap-1 text-[9px] text-jarvis-cyan/30 ml-auto">
            🍅 {task.pomodoros_completed}
          </span>
        )}

        {task.tags.length > 0 && (
          <span className="flex items-center gap-1 text-[9px] text-jarvis-cyan/30">
            <Tag className="w-2.5 h-2.5" aria-hidden="true" />
            {task.tags.length}
          </span>
        )}
      </div>
    </div>
  );
}
