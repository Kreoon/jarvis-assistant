"use client";

import React from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[color:var(--accent)] text-white hover:bg-[color:var(--accent-hover)] active:scale-[0.98]",
  secondary:
    "bg-[color:var(--surface-2)] text-[color:var(--text)] border border-[color:var(--border-strong)] hover:border-[color:var(--accent)] active:scale-[0.98]",
  ghost:
    "text-[color:var(--text-dim)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-2)] active:scale-[0.98]",
  danger:
    "bg-[color:var(--danger)] text-white hover:opacity-90 active:scale-[0.98]",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-7 px-3 text-xs rounded-[var(--radius-sm)]",
  md: "h-9 px-4 text-sm rounded-[var(--radius-md)]",
  lg: "h-11 px-6 text-base rounded-[var(--radius-lg)]",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      className,
      children,
      ...props
    },
    ref
  ) {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium select-none",
          "transition-all duration-200",
          "focus-visible:outline-2 focus-visible:outline-[color:var(--accent)] focus-visible:outline-offset-2",
          "disabled:opacity-40 disabled:pointer-events-none",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <span
            aria-hidden="true"
            className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
          />
        ) : null}
        {children}
      </button>
    );
  }
);
