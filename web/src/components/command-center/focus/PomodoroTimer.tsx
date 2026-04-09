"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import { Play, Pause, SkipForward, RotateCcw } from "lucide-react";
import { incrementPomodoro } from "@/lib/tasks/actions";

const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

interface PomodoroTimerProps {
  taskId: string;
  onCycleComplete?: () => void;
}

type Mode = "work" | "break";

function format(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export function PomodoroTimer({ taskId, onCycleComplete }: PomodoroTimerProps) {
  const [mode, setMode] = useState<Mode>("work");
  const [secondsLeft, setSecondsLeft] = useState(WORK_SECONDS);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setRunning(false);
          if (mode === "work") {
            startTransition(async () => {
              try {
                await incrementPomodoro(taskId);
              } catch (err) {
                console.error("incrementPomodoro failed", err);
              }
            });
            if (onCycleComplete) onCycleComplete();
            try {
              new Audio("/beep.mp3").play().catch(() => {});
            } catch {}
            setMode("break");
            return BREAK_SECONDS;
          } else {
            setMode("work");
            return WORK_SECONDS;
          }
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, mode, taskId, onCycleComplete]);

  const reset = () => {
    setRunning(false);
    setMode("work");
    setSecondsLeft(WORK_SECONDS);
  };

  const skip = () => {
    setRunning(false);
    if (mode === "work") {
      setMode("break");
      setSecondsLeft(BREAK_SECONDS);
    } else {
      setMode("work");
      setSecondsLeft(WORK_SECONDS);
    }
  };

  const modeColor = mode === "work" ? "var(--accent)" : "var(--success)";

  return (
    <div className="flex flex-col items-center gap-6">
      <p
        className="text-[10px] tracking-[0.4em] uppercase font-semibold"
        style={{ color: modeColor }}
      >
        {mode === "work" ? "Trabajo" : "Descanso"}
      </p>

      <div
        className="text-8xl md:text-9xl font-bold tabular-nums tracking-wider"
        style={{ color: modeColor }}
        aria-live="polite"
      >
        {format(secondsLeft)}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          className="rounded-[var(--radius-md)] px-6 py-3 flex items-center gap-2 border border-[color:var(--border)] hover:border-[color:var(--border-strong)] text-[color:var(--text)] hover:bg-[color:var(--surface-solid)] transition-colors"
          aria-label={running ? "Pausar" : "Iniciar"}
        >
          {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span className="text-[10px] tracking-widest uppercase font-semibold">
            {running ? "Pausar" : "Iniciar"}
          </span>
        </button>

        <button
          type="button"
          onClick={skip}
          className="rounded-[var(--radius-md)] px-4 py-3 flex items-center gap-2 border border-[color:var(--border)] hover:border-[color:var(--border-strong)] text-[color:var(--text-dim)] hover:text-[color:var(--text)] transition-colors"
          aria-label="Saltar ciclo"
        >
          <SkipForward className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={reset}
          className="rounded-[var(--radius-md)] px-4 py-3 flex items-center gap-2 border border-[color:var(--border)] hover:border-[color:var(--border-strong)] text-[color:var(--text-dim)] hover:text-[color:var(--text)] transition-colors"
          aria-label="Reiniciar"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
