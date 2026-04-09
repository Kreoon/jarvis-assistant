"use client";

import { useState } from "react";
import { Mic } from "lucide-react";
import { cn } from "@/lib/cn";
import { VoiceWidget } from "@/components/voice/VoiceWidget";

export function MicFAB() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((p) => !p)}
        aria-label="Activar asistente de voz"
        aria-pressed={open}
        className={cn(
          "fixed z-50 flex items-center justify-center",
          "w-14 h-14 rounded-full",
          "bottom-[calc(56px+env(safe-area-inset-bottom)+12px)] right-4",
          "lg:bottom-6 lg:right-6 lg:w-16 lg:h-16",
          "vibrancy border border-[rgba(94,142,255,0.3)]",
          "shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
          "transition-all duration-200",
          "hover:border-[color:var(--accent)] hover:shadow-[0_8px_32px_rgba(94,142,255,0.2)]",
          "active:scale-95",
          open && "border-[color:var(--accent)] text-[color:var(--accent)]"
        )}
      >
        <Mic
          className={cn(
            "w-5 h-5 lg:w-6 lg:h-6 transition-colors duration-200",
            open ? "text-[color:var(--accent)]" : "text-[color:var(--text-dim)]"
          )}
          aria-hidden="true"
        />
      </button>

      <VoiceWidget open={open} onClose={() => setOpen(false)} />
    </>
  );
}
