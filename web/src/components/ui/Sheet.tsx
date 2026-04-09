"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** "bottom" en móvil se usa siempre; en desktop se usa "right" */
  side?: "right" | "bottom";
  className?: string;
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  side = "right",
  className,
}: SheetProps) {
  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Bloquear scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isBottom = side === "bottom";

  const panelVariants = isBottom
    ? {
        hidden: { y: "100%", opacity: 0 },
        visible: { y: 0, opacity: 1 },
        exit: { y: "100%", opacity: 0 },
      }
    : {
        hidden: { x: "100%", opacity: 0 },
        visible: { x: 0, opacity: 1 },
        exit: { x: "100%", opacity: 0 },
      };

  return (
    <AnimatePresence>
      {open ? (
        <div
          className={cn(
            "fixed inset-0 z-50 flex",
            isBottom ? "items-end" : "items-stretch justify-end"
          )}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            className={cn(
              "relative z-10 flex flex-col",
              "vibrancy shadow-[0_-8px_48px_rgba(0,0,0,0.5)]",
              isBottom
                ? [
                    "w-full max-h-[85dvh] rounded-t-[var(--radius-xl)]",
                    "safe-bottom",
                  ]
                : ["h-full w-full max-w-sm", "safe-right"],
              className
            )}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Handle (bottom sheet only) */}
            {isBottom ? (
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-[color:var(--border-strong)]" />
              </div>
            ) : null}

            {/* Header */}
            {title ? (
              <div className="flex items-center justify-between px-5 py-4 flex-shrink-0 border-b border-[color:var(--border)]">
                <h2 className="text-base font-semibold text-[color:var(--text)]">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Cerrar"
                  className={cn(
                    "p-1.5 rounded-[var(--radius-sm)]",
                    "text-[color:var(--text-mute)] hover:text-[color:var(--text)]",
                    "hover:bg-[color:var(--surface-2)] transition-colors duration-200"
                  )}
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ) : null}

            {/* Content */}
            <div className="flex-1 overflow-y-auto scroll-minimal p-5">
              {children}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
