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

  const selectClass =
    "bg-[color:var(--surface-solid)] border border-[color:var(--border)] text-[color:var(--text-dim)] text-[10px] px-2 py-1 rounded-[var(--radius-sm)] tracking-wider uppercase focus:outline-none focus:border-[color:var(--accent)] transition-colors";

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] bg-[color:var(--surface-solid)] border border-[color:var(--border)]"
      role="toolbar"
      aria-label="Filtros del tablero"
    >
      <span className="text-[9px] text-[color:var(--text-mute)] tracking-widest uppercase font-semibold">
        Filtros
      </span>

      {/* Workspace */}
      <select
        className={selectClass}
        value={activeWorkspace ?? ""}
        onChange={(e) => {
          const slug = e.target.value;
          router.push(slug ? `/tasks/${slug}` : `/tasks`);
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
        className={selectClass}
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
        className={selectClass}
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
      <label className="flex items-center gap-1.5 text-[10px] text-[color:var(--text-dim)] tracking-wider uppercase cursor-pointer">
        <input
          type="checkbox"
          checked={showCompleted}
          onChange={(e) => setParam("completed", e.target.checked ? "true" : null)}
          className="accent-[color:var(--accent)]"
        />
        Completadas
      </label>
    </div>
  );
}
