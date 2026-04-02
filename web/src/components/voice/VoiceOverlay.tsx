"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVoiceState } from "../../contexts/VoiceStateContext";

interface VoiceOverlayProps {
  /** Texto del transcript que llega mientras se escucha. */
  transcript?: string;
  /** Respuesta completa de Jarvis para el efecto typewriter. */
  response?: string;
}

/**
 * Overlay semitransparente en el fondo de la pantalla.
 * - LISTENING: muestra el transcript con cursor parpadeante
 * - PROCESSING: indicador de carga animado
 * - SPEAKING: typewriter de la respuesta de Jarvis
 */
export function VoiceOverlay({ transcript = "", response = "" }: VoiceOverlayProps) {
  const { isListening, isProcessing, isSpeaking } = useVoiceState();
  const isVisible = isListening || isProcessing || isSpeaking;

  const [displayed, setDisplayed] = useState("");
  const [charIndex, setCharIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resetear cuando cambia la respuesta
  useEffect(() => {
    setDisplayed("");
    setCharIndex(0);
  }, [response]);

  // Efecto typewriter mientras SPEAKING
  useEffect(() => {
    if (!isSpeaking || !response || charIndex >= response.length) return;

    timerRef.current = setTimeout(() => {
      setDisplayed(response.slice(0, charIndex + 1));
      setCharIndex((prev) => prev + 1);
    }, 22);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isSpeaking, response, charIndex]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="voice-overlay"
          role="status"
          aria-live="polite"
          aria-label="Estado de voz de Jarvis"
          className="absolute bottom-0 left-0 right-0 px-6 py-4 z-40"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          style={{
            background: "var(--jarvis-glass)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderTop: "1px solid rgba(0,229,255,0.2)",
          }}
        >
          {/* Label + indicador de actividad */}
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[9px] tracking-[0.3em] uppercase font-bold text-jarvis-cyan/50">
              {isListening && "ESCUCHANDO"}
              {isProcessing && "PROCESANDO"}
              {isSpeaking && "JARVIS"}
            </span>

            <AnimatePresence mode="wait">
              {isListening && (
                <motion.span
                  key="dot"
                  className="w-1.5 h-1.5 rounded-full bg-jarvis-cyan"
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  exit={{ opacity: 0 }}
                />
              )}
              {isProcessing && (
                <motion.span
                  key="dots"
                  className="flex gap-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-1 h-1 rounded-full bg-jarvis-cyan/70"
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{
                        duration: 0.9,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                    />
                  ))}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* Contenido de texto */}
          <div className="font-mono text-sm leading-relaxed min-h-[1.5rem]">
            {isListening && (
              <p className="text-jarvis-cyan">
                {transcript || (
                  <span className="text-jarvis-cyan/40 italic">
                    Habla ahora...
                  </span>
                )}
                <motion.span
                  className="inline-block w-0.5 h-4 bg-jarvis-cyan ml-0.5 align-middle"
                  animate={{ opacity: [1, 0] }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    repeatType: "reverse",
                  }}
                />
              </p>
            )}

            {isProcessing && (
              <p className="text-jarvis-cyan/60 italic">
                Procesando petición...
              </p>
            )}

            {isSpeaking && (
              <p
                className="text-jarvis-cyan"
                style={{ textShadow: "0 0 8px rgba(0,229,255,0.5)" }}
              >
                {displayed}
                {charIndex < response.length && (
                  <motion.span
                    className="inline-block w-0.5 h-4 bg-jarvis-cyan ml-0.5 align-middle"
                    animate={{ opacity: [1, 0] }}
                    transition={{
                      duration: 0.5,
                      repeat: Infinity,
                      repeatType: "reverse",
                    }}
                  />
                )}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
