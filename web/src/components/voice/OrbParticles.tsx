"use client";

import { useEffect, useRef } from "react";
import { useVoiceState } from "../../contexts/VoiceStateContext";

interface OrbParticlesProps {
  width?: number;
  height?: number;
  /** Función para obtener el volumen promedio normalizado (0–1). */
  getAverageVolume?: () => number;
}

interface Particle {
  angle: number;
  speed: number;
  rx: number;
  ry: number;
  size: number;
  opacity: number;
  phase: number;
  dist: number;
}

const PARTICLE_COUNT = 60;

function createParticle(cx: number, cy: number): Particle {
  const minR = Math.min(cx, cy) * 0.15;
  const maxR = Math.min(cx, cy) * 0.92;
  const rx = minR + Math.random() * (maxR - minR);
  const ry = rx * (0.6 + Math.random() * 0.4);

  return {
    angle: Math.random() * Math.PI * 2,
    speed: (0.003 + Math.random() * 0.008) * (Math.random() < 0.5 ? 1 : -1),
    rx,
    ry,
    size: 0.8 + Math.random() * 1.6,
    opacity: 0.05 + Math.random() * 0.2,
    phase: Math.random() * Math.PI * 2,
    dist: rx,
  };
}

/**
 * Sistema de partículas sobre canvas que reacciona al estado de voz de Jarvis.
 * - IDLE: deriva lenta, baja opacidad
 * - LISTENING: aceleración, partículas convergen hacia el centro
 * - PROCESSING: vórtice espiral
 * - SPEAKING: pulso hacia afuera sincronizado con volumen
 */
export function OrbParticles({
  width = 300,
  height = 300,
  getAverageVolume,
}: OrbParticlesProps) {
  const { machineState } = useVoiceState();
  const stateRef = useRef(machineState.state);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    stateRef.current = machineState.state;
  }, [machineState.state]);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.pointerEvents = "none";

    const container = document.getElementById("orb-particles-mount");
    if (!container) return;
    container.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const cx = width / 2;
    const cy = height / 2;
    const particles = Array.from({ length: PARTICLE_COUNT }, () =>
      createParticle(cx, cy)
    );

    let frame = 0;

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      const currentState = stateRef.current;
      const volume = getAverageVolume?.() ?? 0;
      frame++;

      for (const p of particles) {
        let rxTarget = p.rx;
        let opacityTarget = p.opacity;

        switch (currentState) {
          case "idle":
            p.angle += p.speed * 0.5;
            opacityTarget = 0.08 + Math.sin(frame * 0.02 + p.phase) * 0.06;
            rxTarget = p.rx;
            break;

          case "listening":
            p.angle += p.speed * 2.5;
            rxTarget =
              p.rx * (0.3 + 0.7 * (1 - Math.sin(frame * 0.03 + p.phase) * 0.3));
            opacityTarget = 0.4 + Math.random() * 0.3;
            break;

          case "processing": {
            p.angle += p.speed * 4 + 0.005;
            const spiral = Math.abs(Math.sin(frame * 0.05 + p.phase));
            rxTarget = p.rx * (0.2 + spiral * 0.6);
            opacityTarget = 0.5 + spiral * 0.4;
            break;
          }

          case "speaking": {
            p.angle += p.speed * 1.5;
            const pulse =
              1 + volume * 1.2 + Math.sin(frame * 0.08 + p.phase) * 0.15;
            rxTarget = p.rx * pulse;
            opacityTarget = 0.2 + volume * 0.6;
            break;
          }
        }

        p.dist = p.dist + (rxTarget - p.dist) * 0.08;
        const ry = p.dist * (p.ry / p.rx);

        const x = cx + Math.cos(p.angle) * p.dist;
        const y = cy + Math.sin(p.angle) * ry;

        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 229, 255, ${Math.min(1, Math.max(0, opacityTarget))})`;
        ctx.shadowColor = "rgba(0, 229, 255, 0.6)";
        ctx.shadowBlur = currentState === "idle" ? 2 : 5;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      canvas.remove();
    };
  }, [width, height, getAverageVolume]);

  return (
    <div
      id="orb-particles-mount"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{ width, height }}
    />
  );
}
