"use client";

import { useEffect, useRef } from "react";

interface AudioWaveformProps {
  /** Datos de frecuencia del AnalyserNode (Uint8Array de 0–255). */
  frequencyData: Uint8Array;
  /** Radio del círculo sobre el que se distribuyen las barras (px). */
  size?: number;
}

const BAR_COUNT = 24;
const MIN_HEIGHT = 4;
const MAX_HEIGHT = 30;

/**
 * 24 barras dispuestas en círculo cuya altura sigue los datos de frecuencia
 * del micrófono en tiempo real. Renderizado con Canvas 2D para máxima fluidez.
 */
export function AudioWaveform({ frequencyData, size = 96 }: AudioWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const freqRef = useRef<Uint8Array>(frequencyData);

  // Mantener referencia actualizada sin reiniciar el loop
  useEffect(() => {
    freqRef.current = frequencyData;
  }, [frequencyData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const dim = (size + MAX_HEIGHT) * 2;
    canvas.width = dim * dpr;
    canvas.height = dim * dpr;
    canvas.style.width = `${dim}px`;
    canvas.style.height = `${dim}px`;
    ctx.scale(dpr, dpr);

    const cx = dim / 2;
    const cy = dim / 2;

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, dim, dim);

      const data = freqRef.current;
      const step = data.length > 0 ? Math.floor(data.length / BAR_COUNT) : 1;

      for (let i = 0; i < BAR_COUNT; i++) {
        const angle = (i / BAR_COUNT) * Math.PI * 2 - Math.PI / 2;
        const rawVal = data.length > 0 ? (data[i * step] ?? 0) : 0;
        const barH = MIN_HEIGHT + (rawVal / 255) * (MAX_HEIGHT - MIN_HEIGHT);

        const x1 = cx + Math.cos(angle) * size;
        const y1 = cy + Math.sin(angle) * size;
        const x2 = cx + Math.cos(angle) * (size + barH);
        const y2 = cy + Math.sin(angle) * (size + barH);

        ctx.shadowColor = "rgba(0, 229, 255, 0.8)";
        ctx.shadowBlur = 6;
        ctx.strokeStyle = `rgba(0, 229, 255, ${0.4 + (rawVal / 255) * 0.6})`;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [size]);

  const dim = (size + MAX_HEIGHT) * 2;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none"
      style={{ width: dim, height: dim }}
    />
  );
}
