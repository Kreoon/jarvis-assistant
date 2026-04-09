"use client";

import React, { useState, useRef, useId } from "react";
import { cn } from "@/lib/cn";

interface TooltipProps {
  content: string;
  children: React.ReactElement<Record<string, unknown>>;
  side?: "top" | "right" | "bottom" | "left";
  delayMs?: number;
}

const sideStyles: Record<NonNullable<TooltipProps["side"]>, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
};

export function Tooltip({
  content,
  children,
  side = "top",
  delayMs = 400,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const show = () => {
    timerRef.current = setTimeout(() => setVisible(true), delayMs);
  };

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {React.cloneElement(children, {
        "aria-describedby": visible ? tooltipId : undefined,
      })}
      {visible ? (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-50 whitespace-nowrap",
            "px-2 py-1 rounded-[var(--radius-sm)]",
            "text-[11px] font-medium text-[color:var(--text)]",
            "vibrancy shadow-[0_4px_16px_rgba(0,0,0,0.4)]",
            sideStyles[side]
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
