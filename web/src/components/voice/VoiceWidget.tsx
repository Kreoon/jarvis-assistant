"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Mic, MicOff } from "lucide-react";
import { useVoiceSession } from "@/hooks/useVoiceSession";
import { cn } from "@/lib/cn";

interface VoiceWidgetProps {
  open: boolean;
  onClose: () => void;
}

export function VoiceWidget({ open, onClose }: VoiceWidgetProps) {
  const { state, transcript, interim, messages, error, isSupported, start, stop } =
    useVoiceSession();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, interim]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Stop voice when widget closes
  useEffect(() => {
    if (!open) stop();
  }, [open, stop]);

  const toggle = () => {
    if (state === "listening") stop();
    else start();
  };

  const isListening = state === "listening";
  const isBusy = state === "processing" || state === "speaking";

  return (
    <AnimatePresence>
      {open ? (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel: bottom sheet on mobile, popover corner on desktop */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "fixed z-[70] vibrancy rounded-[var(--radius-xl)] overflow-hidden",
              "shadow-[0_24px_64px_rgba(0,0,0,0.6)]",
              "flex flex-col",
              // Mobile: bottom sheet
              "left-3 right-3 bottom-[calc(72px+env(safe-area-inset-bottom))] max-h-[70vh]",
              // Desktop: corner popover
              "lg:left-auto lg:right-6 lg:bottom-24 lg:w-[400px] lg:h-[520px] lg:max-h-none"
            )}
            role="dialog"
            aria-label="Asistente de voz"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[color:var(--border)]">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-2.5 h-2.5 rounded-full transition-opacity duration-300",
                    isListening
                      ? "bg-[color:var(--accent)] opacity-100"
                      : isBusy
                      ? "bg-[color:var(--warning)] opacity-100"
                      : "bg-[color:var(--text-mute)] opacity-50"
                  )}
                />
                <span className="text-sm font-semibold">Jarvis</span>
                <span className="text-[10px] text-[color:var(--text-mute)] uppercase tracking-widest ml-2">
                  {state === "idle" && "listo"}
                  {state === "listening" && "escuchando"}
                  {state === "processing" && "pensando"}
                  {state === "speaking" && "hablando"}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-[color:var(--text-mute)] hover:text-[color:var(--text)] transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto scroll-minimal px-5 py-4 space-y-4 text-sm"
            >
              {!isSupported && (
                <p className="text-[color:var(--warning)] text-xs">
                  Tu navegador no soporta reconocimiento de voz.
                </p>
              )}
              {error && (
                <p className="text-[color:var(--danger)] text-xs">{error}</p>
              )}
              {messages.length === 0 && !interim && (
                <p className="text-[color:var(--text-mute)] text-xs">
                  Toca el micrófono y hazle una pregunta a Jarvis.
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[85%]",
                    m.role === "user" ? "ml-auto text-right" : "mr-auto"
                  )}
                >
                  <p
                    className={cn(
                      "text-[10px] uppercase tracking-widest mb-1",
                      m.role === "user"
                        ? "text-[color:var(--text-mute)]"
                        : "text-[color:var(--accent)]"
                    )}
                  >
                    {m.role === "user" ? "Tú" : "Jarvis"}
                  </p>
                  <p className="text-[color:var(--text)] leading-relaxed whitespace-pre-wrap">
                    {m.content}
                  </p>
                </div>
              ))}
              {interim && (
                <div className="ml-auto text-right max-w-[85%]">
                  <p className="text-[10px] uppercase tracking-widest text-[color:var(--text-mute)] mb-1">
                    Tú
                  </p>
                  <p className="text-[color:var(--text-dim)] italic">{interim}</p>
                </div>
              )}
            </div>

            {/* Footer controls */}
            <div className="px-5 py-4 border-t border-[color:var(--border)] flex items-center justify-center">
              <button
                type="button"
                onClick={toggle}
                disabled={!isSupported || isBusy}
                className={cn(
                  "flex items-center justify-center w-14 h-14 rounded-full",
                  "border transition-all duration-200",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  isListening
                    ? "bg-[color:var(--accent)]/15 border-[color:var(--accent)] text-[color:var(--accent)] scale-110"
                    : "bg-[color:var(--surface-solid)] border-[color:var(--border-strong)] text-[color:var(--text-dim)] hover:text-[color:var(--text)] hover:border-[color:var(--accent)]/50"
                )}
                aria-label={isListening ? "Detener" : "Hablar"}
              >
                {isListening ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
