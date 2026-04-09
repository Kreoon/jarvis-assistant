import React from "react";
import { cn } from "@/lib/cn";

interface VibrancyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  as?: React.ElementType;
}

export function Vibrancy({
  children,
  as: Tag = "div",
  className,
  ...props
}: VibrancyProps) {
  return (
    <Tag className={cn("vibrancy", className)} {...props}>
      {children}
    </Tag>
  );
}
