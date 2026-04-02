"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { Cpu, Mic, Loader2, Activity } from "lucide-react";
import { cn } from "../../lib/cn";
import { useVoiceState } from "../../contexts/VoiceStateContext";
import { useAudioAnalyzer } from "../../hooks/useAudioAnalyzer";
import { ListeningRings } from "./ListeningRings";
import { AudioWaveform } from "./AudioWaveform";
import { OrbParticles } from "./OrbParticles";

interface VoiceOrbProps {
  /** AnalyserNode activo del micrófono o TTS. Null si no hay audio. */
  analyserNode?: AnalyserNode | null;
  className?: string;
}

const BORDER_COLOR: Record<string, string> = {
  idle: "rgba(0,229,255,0.3)",
  listening: "#00e5ff",
  processing: "#0077ff",
  speaking: "#00e5ff",
};

const GLOW_BASE: Record<string, number> = {
  idle: 20,
  listening: 40,
  processing: 60,
  speaking: 50,
};

/**
 * El orbe central del HUD de Jarvis.
 * Cada estado tiene su propia coreografía de animación.
 * Recibe un AnalyserNode externo para leer audio en tiempo real.
 */
export function VoiceOrb({ analyserNode = null, className }: VoiceOrbProps) {
  const { machineState, isIdle, isListening, isProcessing, isSpeaking } =
    useVoiceState();
  const voiceState = machineState.state;

  const { frequencyData, getAverageVolume } = useAudioAnalyzer(analyserNode);

  const glowControls = useAnimation();
  const fillRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // Actualizar fill y glow dinámicamente con rAF cuando hay audio activo
  useEffect(() => {
    if (!isListening && !isSpeaking) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    function loop() {
      const vol = getAverageVolume();
      if (fillRef.current) {
        fillRef.current.style.height = `${10 + vol * 90}%`;
      }
      const glowPx = GLOW_BASE[voiceState] + vol * 30;
      glowControls.start({
        boxShadow: `0 0 ${glowPx}px ${glowPx / 2}px rgba(0,229,255,0.35)`,
        transition: { duration: 0 },
      });
      rafRef.current = requestAnimationFrame(loop);
    }

    loop();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isListening, isSpeaking, voiceState, getAverageVolume, glowControls]);

  // Variantes del contenedor principal
  const containerVariants = {
    idle: {
      scale: [1, 1.05, 1] as number[],
      transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as const },
    },
    listening: {
      scale: 1,
      transition: { duration: 0.3 },
    },
    processing: {
      scale: [0.95, 1.05, 0.95] as number[],
      transition: { duration: 0.8, repeat: Infinity, ease: "easeInOut" as const },
    },
    speaking: {
      scale: 1,
      transition: { duration: 0.3 },
    },
  };

  const rotationDuration = isProcessing ? 2 : 10;
  const orbitDots = Array.from({ length: 8 }, (_, i) => i);

  return (
    <div
      className={cn(
        "relative flex items-center justify-center",
        "w-32 h-32 md:w-48 md:h-48",
        className
      )}
    >
      {/* Sistema de partículas */}
      <OrbParticles
        width={192}
        height={192}
        getAverageVolume={getAverageVolume}
      />

      {/* Anillos expansivos en LISTENING */}
      <AnimatePresence>
        {isListening && <ListeningRings key="rings" />}
      </AnimatePresence>

      {/* Barras de audio circulares en SPEAKING */}
      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            key="waveform"
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <AudioWaveform frequencyData={frequencyData} size={72} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Puntos orbitales en PROCESSING */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            key="orbit-dots"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {orbitDots.map((i) => (
              <motion.div
                key={i}
                className="absolute inset-0 flex items-center justify-center"
                animate={{ rotate: 360 }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "linear",
                }}
                style={{ rotate: (i / orbitDots.length) * 360 }}
              >
                <span
                  className="absolute w-2 h-2 rounded-full bg-jarvis-cyan shadow-[0_0_6px_var(--jarvis-cyan)]"
                  style={{
                    top: "0%",
                    left: "50%",
                    transform: "translate(-50%, -4px)",
                  }}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contenedor principal del orbe */}
      <motion.div
        className="relative w-full h-full rounded-full flex items-center justify-center"
        variants={containerVariants}
        animate={voiceState}
        style={{
          background:
            "radial-gradient(circle at 40% 35%, rgba(0,229,255,0.08) 0%, rgba(0,8,16,0.9) 70%)",
        }}
      >
        {/* Borde punteado rotante */}
        <motion.div
          className="absolute inset-1 rounded-full border-dashed border-2"
          style={{ borderColor: BORDER_COLOR[voiceState] }}
          animate={{ rotate: 360 }}
          transition={{
            duration: rotationDuration,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        {/* Glow del borde exterior — controlado por useAnimation */}
        <motion.div
          className="absolute inset-0 rounded-full border-2"
          style={{ borderColor: BORDER_COLOR[voiceState] }}
          animate={glowControls}
          initial={{
            boxShadow: `0 0 ${GLOW_BASE[voiceState]}px ${GLOW_BASE[voiceState] / 2}px rgba(0,229,255,0.25)`,
          }}
        />

        {/* Círculo interior con fill de audio */}
        <div
          className="relative w-3/5 h-3/5 rounded-full border-2 border-jarvis-cyan overflow-hidden flex items-center justify-center"
          style={{ boxShadow: "0 0 20px rgba(0,229,255,0.4)" }}
        >
          {/* Fill reactivo al volumen */}
          {(isListening || isSpeaking) && (
            <div
              ref={fillRef}
              className="absolute bottom-0 left-0 right-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,229,255,0.25), transparent)",
                height: "10%",
                transition: "none",
              }}
            />
          )}

          {/* Respiración sutil en IDLE */}
          {isIdle && (
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ background: "rgba(0,229,255,0.05)" }}
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          {/* Icono central — transición suave entre estados */}
          <AnimatePresence mode="wait">
            {isIdle && (
              <motion.div
                key="icon-idle"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.25 }}
              >
                <Cpu className="w-8 h-8 text-jarvis-cyan" />
              </motion.div>
            )}
            {isListening && (
              <motion.div
                key="icon-listen"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.25 }}
              >
                <Mic className="w-8 h-8 text-jarvis-cyan" />
              </motion.div>
            )}
            {isProcessing && (
              <motion.div
                key="icon-proc"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1, rotate: 360 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{
                  opacity: { duration: 0.25 },
                  scale: { duration: 0.25 },
                  rotate: { duration: 1, repeat: Infinity, ease: "linear" },
                }}
              >
                <Loader2 className="w-8 h-8 text-jarvis-cyan" />
              </motion.div>
            )}
            {isSpeaking && (
              <motion.div
                key="icon-speak"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.25 }}
              >
                <Activity className="w-8 h-8 text-jarvis-cyan" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
