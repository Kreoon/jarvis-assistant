"use client";

import React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { label, error, options, placeholder, className, id, ...props },
    ref
  ) {
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
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            className={cn(
              "h-9 w-full px-3 pr-8 text-sm appearance-none",
              "bg-[color:var(--surface-solid)] text-[color:var(--text)]",
              "border border-[color:var(--border)] rounded-[var(--radius-md)]",
              "transition-colors duration-200",
              "hover:border-[color:var(--border-strong)]",
              "focus:outline-none focus:border-[color:var(--accent)]",
              "disabled:opacity-40 disabled:pointer-events-none",
              "cursor-pointer",
              error && "border-[color:var(--danger)] focus:border-[color:var(--danger)]",
              className
            )}
            {...props}
          >
            {placeholder ? (
              <option value="" disabled>
                {placeholder}
              </option>
            ) : null}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[color:var(--text-mute)] pointer-events-none"
            aria-hidden="true"
          />
        </div>
        {error ? (
          <p className="text-xs text-[color:var(--danger)]">{error}</p>
        ) : null}
      </div>
    );
  }
);
