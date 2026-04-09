"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { PRIORITY_LABELS } from "@/lib/tasks/types";
import type { TaskPriority, Workspace } from "@/lib/tasks/types";

interface FiltersProps {
  workspaces: Workspace[];
  activeWorkspace?: string;
}

const PRIORITIES: TaskPriority[] = ["urgent", "high", "medium", "low"];

export function Filters({ workspaces, activeWorkspace }: FiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const currentPriority = searchParams.get("priority") ?? "";
  const currentDate = searchParams.get("date") ?? "";
  const showCompleted = searchParams.get("completed") === "true";

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-3 py-2 glass-panel"
      role="toolbar"
      aria-label="Filtros del tablero"
    >
      <span className="text-[9px] text-jarvis-cyan/40 tracking-widest uppercase font-bold">
        Filtros
      </span>

      {/* Workspace */}
      <select
        className="bg-black/40 border border-jarvis-cyan/20 text-jarvis-cyan/80 text-[10px] px-2 py-1 rounded-sm tracking-wider uppercase"
        value={activeWorkspace ?? ""}
        onChange={(e) => {
          const slug = e.target.value;
          router.push(slug ? `/command-center/board/${slug}` : `/command-center/board`);
        }}
        aria-label="Filtrar por workspace"
      >
        <option value="">Todos los workspaces</option>
        {workspaces.map((w) => (
          <option key={w.id} value={w.slug}>
            {w.name}
          </option>
        ))}
      </select>

      {/* Prioridad */}
      <select
        className="bg-black/40 border border-jarvis-cyan/20 text-jarvis-cyan/80 text-[10px] px-2 py-1 rounded-sm tracking-wider uppercase"
        value={currentPriority}
        onChange={(e) => setParam("priority", e.target.value || null)}
        aria-label="Filtrar por prioridad"
      >
        <option value="">Cualquier prioridad</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABELS[p]}
          </option>
        ))}
      </select>

      {/* Fecha */}
      <select
        className="bg-black/40 border border-jarvis-cyan/20 text-jarvis-cyan/80 text-[10px] px-2 py-1 rounded-sm tracking-wider uppercase"
        value={currentDate}
        onChange={(e) => setParam("date", e.target.value || null)}
        aria-label="Filtrar por fecha"
      >
        <option value="">Cualquier fecha</option>
        <option value="today">Hoy</option>
        <option value="week">Esta semana</option>
        <option value="none">Sin fecha</option>
      </select>

      {/* Completadas */}
      <label className="flex items-center gap-1.5 text-[10px] text-jarvis-cyan/60 tracking-wider uppercase cursor-pointer">
        <input
          type="checkbox"
          checked={showCompleted}
          onChange={(e) => setParam("completed", e.target.checked ? "true" : null)}
          className="accent-jarvis-cyan"
        />
        Completadas
      </label>
    </div>
  );
}
