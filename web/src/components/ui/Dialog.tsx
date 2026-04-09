"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: DialogProps) {
  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Bloquear scroll del body
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

  return (
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
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
              "relative z-10 w-full max-w-md",
              "vibrancy rounded-[var(--radius-xl)]",
              "shadow-[0_24px_64px_rgba(0,0,0,0.6)]",
              className
            )}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Header */}
            {(title || description) ? (
              <div className="flex items-start justify-between p-5 pb-0">
                <div>
                  {title ? (
                    <h2 className="text-base font-semibold text-[color:var(--text)]">
                      {title}
                    </h2>
                  ) : null}
                  {description ? (
                    <p className="mt-0.5 text-sm text-[color:var(--text-dim)]">
                      {description}
                    </p>
                  ) : null}
                </div>
                <button
                  onClick={onClose}
                  aria-label="Cerrar"
                  className={cn(
                    "ml-4 p-1.5 rounded-[var(--radius-sm)]",
                    "text-[color:var(--text-mute)] hover:text-[color:var(--text)]",
                    "hover:bg-[color:var(--surface-2)] transition-colors duration-200"
                  )}
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            ) : null}

            {/* Content */}
            <div className="p-5">{children}</div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
