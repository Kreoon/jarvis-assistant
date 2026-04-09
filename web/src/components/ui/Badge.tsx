import React from "react";
import { cn } from "@/lib/cn";

type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  neutral:
    "bg-[color:var(--surface-2)] text-[color:var(--text-dim)] border border-[color:var(--border)]",
  accent:
    "bg-[rgba(94,142,255,0.15)] text-[color:var(--accent)] border border-[rgba(94,142,255,0.25)]",
  success:
    "bg-[rgba(48,209,88,0.15)] text-[color:var(--success)] border border-[rgba(48,209,88,0.25)]",
  warning:
    "bg-[rgba(255,159,10,0.15)] text-[color:var(--warning)] border border-[rgba(255,159,10,0.25)]",
  danger:
    "bg-[rgba(255,69,58,0.15)] text-[color:var(--danger)] border border-[rgba(255,69,58,0.25)]",
};

export function Badge({
  variant = "neutral",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium leading-none",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
