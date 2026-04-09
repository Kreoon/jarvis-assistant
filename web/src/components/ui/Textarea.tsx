"use client";

import React from "react";
import { cn } from "@/lib/cn";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, error, className, id, ...props }, ref) {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label ? (
          <label
            htmlFor={inputId}
            className="text-xs font-medium text-[color:var(--text-dim)]"
          >
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "min-h-[80px] w-full px-3 py-2 text-sm resize-y",
            "bg-[color:var(--surface-solid)] text-[color:var(--text)]",
            "border border-[color:var(--border)] rounded-[var(--radius-md)]",
            "placeholder:text-[color:var(--text-mute)]",
            "transition-colors duration-200",
            "hover:border-[color:var(--border-strong)]",
            "focus:outline-none focus:border-[color:var(--accent)]",
            "disabled:opacity-40 disabled:pointer-events-none",
            "scroll-minimal",
            error && "border-[color:var(--danger)] focus:border-[color:var(--danger)]",
            className
          )}
          {...props}
        />
        {error ? (
          <p className="text-xs text-[color:var(--danger)]">{error}</p>
        ) : null}
      </div>
    );
  }
);
