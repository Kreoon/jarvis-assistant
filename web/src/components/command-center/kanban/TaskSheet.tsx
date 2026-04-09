"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, Trash2, Focus } from "lucide-react";
import Link from "next/link";
import { updateTask, completeTask, softDeleteTask } from "@/lib/tasks/actions";
import { PRIORITY_COLORS, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/tasks/types";
import type { Task, TaskPriority, TaskStatus, Workspace } from "@/lib/tasks/types";
import { cn } from "@/lib/cn";

interface TaskSheetProps {
  task: Task | null;
  workspaces: Workspace[];
  onClose: () => void;
  onTaskUpdated: (task: Task) => void;
  onTaskDeleted: (id: string) => void;
}

export function TaskSheet({
  task,
  workspaces,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}: TaskSheetProps) {
  const [isPending, startTransition] = useTransition();
  const [editTitle, setEditTitle] = useState(task?.title ?? "");
  const [editDesc, setEditDesc] = useState(task?.description ?? "");
  const [editPriority, setEditPriority] = useState<TaskPriority>(
    task?.priority ?? "medium"
  );
  const [editDueDate, setEditDueDate] = useState(task?.due_date ?? "");
  const [editWorkspaceId, setEditWorkspaceId] = useState(
    task?.workspace_id ?? ""
  );

  // Sincronizar cuando cambia la tarea seleccionada
  if (task && task.title !== editTitle && editTitle === "") {
    setEditTitle(task.title);
    setEditDesc(task.description ?? "");
    setEditPriority(task.priority);
    setEditDueDate(task.due_date ?? "");
    setEditWorkspaceId(task.workspace_id);
  }

  const handleSave = () => {
    if (!task) return;
    startTransition(async () => {
      await updateTask(task.id, {
        title: editTitle,
        description: editDesc || null,
        priority: editPriority,
        due_date: editDueDate || null,
        workspace_id: editWorkspaceId,
      });
      onTaskUpdated({ ...task, title: editTitle, priority: editPriority });
    });
  };

  const handleComplete = () => {
    if (!task) return;
    startTransition(async () => {
      await completeTask(task.id);
      onTaskDeleted(task.id);
      onClose();
    });
  };

  const handleDelete = () => {
    if (!task) return;
    startTransition(async () => {
      await softDeleteTask(task.id);
      onTaskDeleted(task.id);
      onClose();
    });
  };

  return (
    <AnimatePresence>
      {task && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,8,16,0.4)" }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel lateral */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="fixed right-0 top-0 h-full z-50 w-full max-w-[420px] glass-panel flex flex-col border-l border-jarvis-cyan/20 overflow-y-auto custom-scrollbar"
            role="dialog"
            aria-modal="true"
            aria-label={`Detalles: ${task.title}`}
          >
            <div className="hud-border hud-tl" />
            <div className="hud-border hud-bl" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-jarvis-cyan/10 flex-shrink-0">
              <span className="text-[9px] text-jarvis-cyan/40 tracking-widest uppercase font-bold">
                Detalle de tarea
              </span>
              <div className="flex items-center gap-3">
                <Link
                  href={`/command-center/focus?task=${task.id}`}
                  className="text-[9px] text-jarvis-cyan/50 hover:text-jarvis-cyan tracking-widest transition-colors flex items-center gap-1"
                  onClick={onClose}
                >
                  <Focus className="w-3 h-3" />
                  FOCO
                </Link>
                <button
                  onClick={onClose}
                  aria-label="Cerrar panel"
                  className="text-jarvis-cyan/30 hover:text-jarvis-cyan transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 px-5 py-4 flex flex-col gap-5">
              {/* Título */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] text-jarvis-cyan/40 tracking-widest uppercase">
                  Título
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleSave}
                  className="bg-transparent border-b border-jarvis-cyan/20 focus:border-jarvis-cyan/60 py-1 text-sm text-white focus:outline-none transition-colors tracking-wide"
                />
              </div>

              {/* Descripción */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] text-jarvis-cyan/40 tracking-widest uppercase">
                  Descripción
                </label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  onBlur={handleSave}
                  rows={3}
                  placeholder="Sin descripción..."
                  className="bg-black/30 border border-jarvis-cyan/15 focus:border-jarvis-cyan/40 p-2 text-xs text-white/70 focus:outline-none transition-colors resize-none rounded-sm placeholder:text-jarvis-cyan/15"
                />
              </div>

              {/* Row: prioridad + workspace */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] text-jarvis-cyan/40 tracking-widest uppercase">
                    Prioridad
                  </label>
                  <select
                    value={editPriority}
                    onChange={(e) => {
                      setEditPriority(e.target.value as TaskPriority);
                    }}
                    onBlur={handleSave}
                    className="bg-black/40 border border-jarvis-cyan/20 text-jarvis-cyan/80 text-[11px] px-2 py-1.5 focus:outline-none focus:border-jarvis-cyan/50"
                    style={{ color: PRIORITY_COLORS[editPriority] }}
                    aria-label="Prioridad"
                  >
                    {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map(
                      (p) => (
                        <option key={p} value={p}>
                          {PRIORITY_LABELS[p]}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] text-jarvis-cyan/40 tracking-widest uppercase">
                    Workspace
                  </label>
                  <select
                    value={editWorkspaceId}
                    onChange={(e) => {
                      setEditWorkspaceId(e.target.value);
                    }}
                    onBlur={handleSave}
                    className="bg-black/40 border border-jarvis-cyan/20 text-jarvis-cyan/80 text-[11px] px-2 py-1.5 focus:outline-none focus:border-jarvis-cyan/50"
                    aria-label="Workspace"
                  >
                    {workspaces.map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        {ws.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Due date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] text-jarvis-cyan/40 tracking-widest uppercase">
                  Fecha límite
                </label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  onBlur={handleSave}
                  className="bg-black/40 border border-jarvis-cyan/20 text-jarvis-cyan/80 text-[11px] px-2 py-1.5 focus:outline-none focus:border-jarvis-cyan/50 w-full"
                  aria-label="Fecha límite"
                />
              </div>

              {/* Metadata */}
              <div className="flex flex-col gap-1 pt-2 border-t border-jarvis-cyan/10">
                <div className="flex justify-between text-[9px]">
                  <span className="text-jarvis-cyan/30">Status</span>
                  <span className="text-jarvis-cyan/60">
                    {STATUS_LABELS[task.status]}
                  </span>
                </div>
                <div className="flex justify-between text-[9px]">
                  <span className="text-jarvis-cyan/30">Pomodoros</span>
                  <span className="text-jarvis-cyan/60">
                    {task.pomodoros_completed}
                  </span>
                </div>
                <div className="flex justify-between text-[9px]">
                  <span className="text-jarvis-cyan/30">Fuente</span>
                  <span className="text-jarvis-cyan/60 uppercase">
                    {task.source}
                  </span>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-jarvis-cyan/10 flex gap-3">
              <button
                onClick={handleComplete}
                disabled={isPending || task.status === "done"}
                className="flex-1 flex items-center justify-center gap-2 py-2 text-[10px] tracking-widest font-bold border border-[#10b981]/40 text-[#10b981] bg-[#10b981]/10 hover:bg-[#10b981]/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                aria-label="Completar tarea"
              >
                <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
                COMPLETAR
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex items-center justify-center gap-2 px-4 py-2 text-[10px] tracking-widest font-bold border border-[#ef4444]/30 text-[#ef4444]/60 hover:text-[#ef4444] hover:border-[#ef4444]/60 hover:bg-[#ef4444]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                aria-label="Eliminar tarea"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
