"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus } from "lucide-react";
import { createTask } from "@/lib/tasks/actions";
import { PRIORITY_LABELS } from "@/lib/tasks/types";
import type { TaskPriority, Workspace } from "@/lib/tasks/types";
import { cn } from "@/lib/cn";

interface QuickCaptureProps {
  workspaces: Workspace[];
}

export function QuickCapture({ workspaces }: QuickCaptureProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState(workspaces[0]?.slug ?? "");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const titleRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Atajo global Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Focus al abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => titleRef.current?.focus(), 50);
    } else {
      // Reset al cerrar
      setTitle("");
      setWorkspaceSlug(workspaces[0]?.slug ?? "");
      setPriority("medium");
      setDueDate("");
      setConfirmed(false);
    }
  }, [open, workspaces]);

  const handleSubmit = () => {
    if (!title.trim() || !workspaceSlug) return;

    startTransition(async () => {
      await createTask({
        title: title.trim(),
        workspaceSlug,
        priority,
        dueDate: dueDate || undefined,
      });

      // Flash de confirmación, luego cerrar
      setConfirmed(true);
      setTimeout(() => {
        setOpen(false);
      }, 500);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Click fuera cierra
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-[10px] tracking-widest text-jarvis-cyan/60 hover:text-jarvis-cyan border border-jarvis-cyan/20 hover:border-jarvis-cyan/50 hover:bg-jarvis-cyan/5 transition-all duration-200 rounded-sm"
        aria-label="Abrir captura rápida (Ctrl+K)"
        title="Ctrl+K"
      >
        <Plus className="w-3 h-3" aria-hidden="true" />
        NUEVA TAREA
        <kbd className="text-[8px] text-jarvis-cyan/30 ml-1">⌘K</kbd>
      </button>

      {/* Modal overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: "rgba(0,8,16,0.8)", backdropFilter: "blur(4px)" }}
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-label="Captura rápida de tarea"
          >
            <motion.div
              ref={modalRef}
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={cn(
                "glass-panel w-full max-w-lg p-5",
                confirmed && "capture-confirm"
              )}
            >
              <div className="hud-border hud-tl" />
              <div className="hud-border hud-tr" />
              <div className="hud-border hud-bl" />
              <div className="hud-border hud-br" />

              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] text-jarvis-cyan/60 tracking-widest uppercase font-bold">
                  Captura rápida
                </span>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="text-jarvis-cyan/30 hover:text-jarvis-cyan transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Título */}
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="¿Qué hay que hacer?"
                className="w-full bg-transparent border-b border-jarvis-cyan/20 focus:border-jarvis-cyan/60 pb-2 mb-4 text-sm text-white placeholder:text-jarvis-cyan/20 focus:outline-none transition-colors tracking-wide"
                autoComplete="off"
              />

              {/* Fila de opciones */}
              <div className="flex flex-wrap gap-3 mb-4">
                {/* Workspace select */}
                <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                  <label className="text-[9px] text-jarvis-cyan/40 tracking-widest uppercase">
                    Workspace
                  </label>
                  <select
                    value={workspaceSlug}
                    onChange={(e) => setWorkspaceSlug(e.target.value)}
                    className="bg-black/40 border border-jarvis-cyan/20 text-jarvis-cyan/80 text-[11px] px-2 py-1.5 focus:outline-none focus:border-jarvis-cyan/50 tracking-wide"
                    aria-label="Seleccionar workspace"
                  >
                    {workspaces.map((ws) => (
                      <option key={ws.id} value={ws.slug}>
                        {ws.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Prioridad select */}
                <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
                  <label className="text-[9px] text-jarvis-cyan/40 tracking-widest uppercase">
                    Prioridad
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className="bg-black/40 border border-jarvis-cyan/20 text-jarvis-cyan/80 text-[11px] px-2 py-1.5 focus:outline-none focus:border-jarvis-cyan/50 tracking-wide"
                    aria-label="Seleccionar prioridad"
                  >
                    {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Due date */}
                <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                  <label className="text-[9px] text-jarvis-cyan/40 tracking-widest uppercase">
                    Fecha límite
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="bg-black/40 border border-jarvis-cyan/20 text-jarvis-cyan/80 text-[11px] px-2 py-1.5 focus:outline-none focus:border-jarvis-cyan/50 tracking-wide"
                    aria-label="Fecha límite opcional"
                  />
                </div>
              </div>

              {/* Botón crear */}
              <div className="flex items-center justify-between">
                <p className="text-[9px] text-jarvis-cyan/25">
                  Enter para crear · Esc para cancelar
                </p>
                <button
                  onClick={handleSubmit}
                  disabled={!title.trim() || isPending || confirmed}
                  className="px-4 py-1.5 text-[10px] tracking-widest font-bold border border-jarvis-cyan/40 text-jarvis-cyan bg-jarvis-cyan/10 hover:bg-jarvis-cyan/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                  aria-label="Crear tarea"
                >
                  {isPending ? "CREANDO..." : confirmed ? "CREADO" : "CREAR →"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
