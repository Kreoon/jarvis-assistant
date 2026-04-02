"use client";

import React from "react";
import { cn } from "../../lib/cn";

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function GlassPanel({ children, className, title }: GlassPanelProps) {
  return (
    <div className={cn("glass-panel p-4 relative group", className)}>
      <div className="hud-border hud-tl" />
      <div className="hud-border hud-tr" />
      <div className="hud-border hud-bl" />
      <div className="hud-border hud-br" />
      {title && (
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-jarvis-cyan/80 font-bold">
            {title}
          </span>
          <div className="h-px bg-jarvis-cyan/20 flex-grow ml-4" />
        </div>
      )}
      {children}
    </div>
  );
}
