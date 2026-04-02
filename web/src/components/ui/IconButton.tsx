"use client";

import React from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

interface IconButtonProps {
  icon: LucideIcon;
  active?: boolean;
  onClick: () => void;
  label: string;
}

export function IconButton({ icon: Icon, active, onClick, label }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "relative p-3 transition-all duration-300 group",
        active
          ? "text-jarvis-cyan scale-110"
          : "text-jarvis-cyan/40 hover:text-jarvis-cyan/80"
      )}
    >
      <Icon className="w-6 h-6" />
      {active && (
        <motion.div
          layoutId="active-indicator"
          className="absolute inset-0 border border-jarvis-cyan/50 rounded-lg"
          initial={false}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
      <span className="absolute left-16 top-1/2 -translate-y-1/2 bg-jarvis-cyan text-background text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none tracking-widest font-bold z-50">
        {label}
      </span>
    </button>
  );
}
