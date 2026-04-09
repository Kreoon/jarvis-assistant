"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, Trash2, Focus } from "lucide-react";
import Link from "next/link";
import { updateTask, completeTask, softDeleteTask } from "@/lib/tasks/actions";
import { PRIORITY_COLORS, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/tasks/types";
import type { Task, TaskPriority, TaskStatus, Workspace } from "@/lib/tasks/types";

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

  const labelClass = "text-[9px] text-[color:var(--text-mute)] tracking-widest uppercase";
  const inputClass =
    "bg-transparent border-b border-[color:var(--border)] focus:border-[color:var(--accent)] py-1 text-sm text-[color:var(--text)] focus:outline-none transition-colors tracking-wide";
  const selectClass =
    "bg-[color:var(--surface-solid)] border border-[color:var(--border)] text-[color:var(--text-dim)] text-[11px] px-2 py-1.5 rounded-[var(--radius-sm)] focus:outline-none focus:border-[color:var(--accent)] transition-colors";

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
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel lateral */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="fixed right-0 top-0 h-full z-50 w-full max-w-[420px] vibrancy flex flex-col border-l border-[color:var(--border)] overflow-y-auto scroll-minimal"
            role="dialog"
            aria-modal="true"
            aria-label={`Detalles: ${task.title}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[color:var(--border)] flex-shrink-0">
              <span className="text-[9px] text-[color:var(--text-mute)] tracking-widest uppercase font-semibold">
                Detalle de tarea
              </span>
              <div className="flex items-center gap-3">
                <Link
                  href={`/focus?task=${task.id}`}
                  className="text-[9px] text-[color:var(--text-dim)] hover:text-[color:var(--accent)] tracking-widest transition-colors flex items-center gap-1"
                  onClick={onClose}
                >
                  <Focus className="w-3 h-3" />
                  FOCO
                </Link>
                <button
                  onClick={onClose}
                  aria-label="Cerrar panel"
                  className="text-[color:var(--text-mute)] hover:text-[color:var(--text)] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 px-5 py-4 flex flex-col gap-5">
              {/* Título */}
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Título</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleSave}
                  className={inputClass}
                />
              </div>

              {/* Descripción */}
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Descripción</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  onBlur={handleSave}
                  rows={3}
                  placeholder="Sin descripción..."
                  className="bg-[color:var(--surface-solid)] border border-[color:var(--border)] focus:border-[color:var(--accent)] p-2 text-xs text-[color:var(--text-dim)] focus:outline-none transition-colors resize-none rounded-[var(--radius-sm)] placeholder:text-[color:var(--text-mute)]"
                />
              </div>

              {/* Row: prioridad + workspace */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Prioridad</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                    onBlur={handleSave}
                    className={selectClass}
                    style={{ color: PRIORITY_COLORS[editPriority] }}
                    aria-label="Prioridad"
                  >
                    {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Workspace</label>
                  <select
                    value={editWorkspaceId}
                    onChange={(e) => setEditWorkspaceId(e.target.value)}
                    onBlur={handleSave}
                    className={selectClass}
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
                <label className={labelClass}>Fecha límite</label>
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  onBlur={handleSave}
                  className={`${selectClass} w-full`}
                  aria-label="Fecha límite"
                />
              </div>

              {/* Metadata */}
              <div className="flex flex-col gap-1 pt-2 border-t border-[color:var(--border)]">
                <div className="flex justify-between text-[9px]">
                  <span className="text-[color:var(--text-mute)]">Status</span>
                  <span className="text-[color:var(--text-dim)]">
                    {STATUS_LABELS[task.status]}
                  </span>
                </div>
                <div className="flex justify-between text-[9px]">
                  <span className="text-[color:var(--text-mute)]">Pomodoros</span>
                  <span className="text-[color:var(--text-dim)]">
                    {task.pomodoros_completed}
                  </span>
                </div>
                <div className="flex justify-between text-[9px]">
                  <span className="text-[color:var(--text-mute)]">Fuente</span>
                  <span className="text-[color:var(--text-dim)] uppercase">
                    {task.source}
                  </span>
                </div>
              </div>
            </div>

            {/* Acciones */}
            <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t border-[color:var(--border)] flex gap-3">
              <button
                onClick={handleComplete}
                disabled={isPending || task.status === "done"}
                className="flex-1 flex items-center justify-center gap-2 py-2 text-[10px] tracking-widest font-semibold rounded-[var(--radius-sm)] border border-[color:var(--success)]/40 text-[color:var(--success)] bg-[color:var(--success)]/10 hover:bg-[color:var(--success)]/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                aria-label="Completar tarea"
              >
                <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />
                COMPLETAR
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="flex items-center justify-center gap-2 px-4 py-2 text-[10px] tracking-widest font-semibold rounded-[var(--radius-sm)] border border-[color:var(--danger)]/30 text-[color:var(--danger)]/60 hover:text-[color:var(--danger)] hover:border-[color:var(--danger)]/60 hover:bg-[color:var(--danger)]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
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
