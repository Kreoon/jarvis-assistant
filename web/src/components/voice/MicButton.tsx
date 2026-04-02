"use client";

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useVoiceState } from "../../contexts/VoiceStateContext";

interface MicButtonProps {
  onToggle?: (active: boolean) => void;
}

const GLOW: Record<string, string> = {
  idle: "0 0 12px rgba(0,229,255,0.2)",
  listening: "0 0 24px rgba(0,229,255,0.7), 0 0 48px rgba(0,229,255,0.3)",
  processing: "0 0 20px rgba(0,119,255,0.5)",
  speaking: "0 0 16px rgba(0,229,255,0.4)",
};

/**
 * Botón flotante de micrófono.
 * - Click: alterna listening on/off
 * - Espacio (hold): activa mientras se mantiene presionado
 * - Muestra Mic | MicOff | Loader2 según el estado
 */
export function MicButton({ onToggle }: MicButtonProps) {
  const { machineState, dispatch, isListening, isProcessing } = useVoiceState();
  const voiceState = machineState.state;

  const handleToggle = useCallback(() => {
    if (isProcessing) return;
    if (isListening) {
      dispatch({ type: "CANCEL" });
      onToggle?.(false);
    } else {
      dispatch({ type: "START_LISTENING" });
      onToggle?.(true);
    }
  }, [isListening, isProcessing, dispatch, onToggle]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      if (!isListening && !isProcessing) {
        dispatch({ type: "START_LISTENING" });
        onToggle?.(true);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (isListening) {
        dispatch({ type: "STOP_LISTENING" });
        onToggle?.(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [isListening, isProcessing, dispatch, onToggle]);

  const icon = isProcessing ? (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    >
      <Loader2 className="w-6 h-6" />
    </motion.div>
  ) : isListening ? (
    <MicOff className="w-6 h-6" />
  ) : (
    <Mic className="w-6 h-6" />
  );

  return (
    <motion.button
      onClick={handleToggle}
      disabled={isProcessing}
      aria-label={
        isListening
          ? "Detener escucha"
          : isProcessing
          ? "Procesando"
          : "Activar micrófono (o mantén Espacio)"
      }
      aria-pressed={isListening}
      className="relative w-14 h-14 rounded-full flex items-center justify-center text-jarvis-cyan border-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
      style={{
        background: isListening
          ? "rgba(0,229,255,0.15)"
          : "rgba(0,8,16,0.8)",
        borderColor: isListening ? "var(--jarvis-cyan)" : "rgba(0,229,255,0.4)",
        boxShadow: GLOW[voiceState],
      }}
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      <AnimatePresence>
        {isListening && (
          <motion.span
            key="pulse"
            className="absolute inset-0 rounded-full border border-jarvis-cyan"
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 1.9, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>

      {icon}
    </motion.button>
  );
}
