import React from "react";
import { cn } from "@/lib/cn";

type CardVariant = "default" | "vibrancy" | "elevated";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  children: React.ReactNode;
}

const variantStyles: Record<CardVariant, string> = {
  default:
    "bg-[color:var(--surface-solid)] border border-[color:var(--border)]",
  vibrancy: "vibrancy",
  elevated:
    "bg-[color:var(--surface-solid)] border border-[color:var(--border-strong)] shadow-[0_4px_24px_rgba(0,0,0,0.4)]",
};

export function Card({
  variant = "default",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] p-4",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
