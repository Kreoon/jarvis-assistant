"use client";

import { motion } from "framer-motion";

/**
 * 3 anillos concéntricos que se expanden desde el centro mientras Jarvis escucha.
 * Cada anillo tiene un delay escalonado para el efecto sonar/radar.
 */
export function ListeningRings() {
  const rings = [{ delay: 0 }, { delay: 0.5 }, { delay: 1.0 }];

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      {rings.map((ring, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full border border-jarvis-cyan"
          style={{ width: "100%", height: "100%" }}
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: 2.5, opacity: 0 }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            delay: ring.delay,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}
