"use client";

import React from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Tooltip } from "./Tooltip";

interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  tooltip?: boolean;
  tooltipSide?: "top" | "right" | "bottom" | "left";
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { btn: "w-7 h-7", icon: "w-3.5 h-3.5" },
  md: { btn: "w-9 h-9", icon: "w-4 h-4" },
  lg: { btn: "w-11 h-11", icon: "w-5 h-5" },
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon: Icon,
      label,
      active = false,
      tooltip = false,
      tooltipSide = "right",
      size = "md",
      className,
      ...props
    },
    ref
  ) {
    const sizes = sizeMap[size];

    const btn = (
      <button
        ref={ref}
        aria-label={label}
        aria-pressed={active}
        className={cn(
          "inline-flex items-center justify-center rounded-[var(--radius-md)]",
          "transition-colors duration-200 select-none",
          "focus-visible:outline-2 focus-visible:outline-[color:var(--accent)] focus-visible:outline-offset-2",
          "disabled:opacity-40 disabled:pointer-events-none",
          sizes.btn,
          active
            ? "bg-[color:var(--surface-2)] text-[color:var(--accent)]"
            : "text-[color:var(--text-mute)] hover:text-[color:var(--text-dim)] hover:bg-[color:var(--surface-2)]",
          className
        )}
        {...props}
      >
        <Icon className={sizes.icon} aria-hidden="true" />
      </button>
    );

    if (tooltip) {
      return (
        <Tooltip content={label} side={tooltipSide}>
          {btn}
        </Tooltip>
      );
    }

    return btn;
  }
);
