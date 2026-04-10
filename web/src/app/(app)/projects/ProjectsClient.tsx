"use client";

import { useMemo, useState } from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import type { ProjectWithStats, ProjectStatus } from "@/lib/projects/types";
import type { Workspace } from "@/lib/tasks/types";

interface ProjectsClientProps {
  projects: ProjectWithStats[];
  workspaces: Workspace[];
}

type Filter = "all" | "active" | "paused" | "done" | "archived";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Activos" },
  { id: "paused", label: "Pausados" },
  { id: "done", label: "Completados" },
  { id: "archived", label: "Archivados" },
];

export function ProjectsClient({ projects, workspaces }: ProjectsClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("active");

  const workspaceMap = useMemo(
    () => new Map(workspaces.map((ws) => [ws.id, ws])),
    [workspaces]
  );

  // Filter by status
  const filteredProjects = useMemo(() => {
    if (filter === "all") return projects;
    return projects.filter((p) => (p.status as ProjectStatus) === filter);
  }, [projects, filter]);

  // Group by workspace, preserving workspace sort_order
  const grouped = useMemo(() => {
    const byWs = new Map<string, ProjectWithStats[]>();
    for (const p of filteredProjects) {
      const list = byWs.get(p.workspace_id) ?? [];
      list.push(p);
      byWs.set(p.workspace_id, list);
    }
    return workspaces
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((ws) => ({ workspace: ws, items: byWs.get(ws.id) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [filteredProjects, workspaces]);

  // Counts per filter (for badges)
  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: projects.length,
      active: 0,
      paused: 0,
      done: 0,
      archived: 0,
    };
    for (const p of projects) {
      const s = p.status as ProjectStatus;
      if (s in c) c[s as Filter]++;
    }
    return c;
  }, [projects]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--text)]">
            Proyectos
          </h1>
          <p className="text-sm text-[color:var(--text-dim)] mt-1">
            {filteredProjects.length} de {projects.length} · {grouped.length} categorías
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          Nuevo proyecto
        </Button>
      </div>

      {/* Filter tabs */}
      <div
        className="flex items-center gap-1 mb-8 overflow-x-auto scroll-minimal"
        role="tablist"
        aria-label="Filtrar proyectos por estado"
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          const count = counts[f.id];
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              role="tab"
              aria-selected={active}
              className={
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 " +
                (active
                  ? "bg-[color:var(--accent)] text-white"
                  : "text-[color:var(--text-dim)] hover:text-[color:var(--text)] hover:bg-[color:var(--surface-solid)]")
              }
            >
              {f.label} <span className="opacity-60 ml-1">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Grouped by workspace */}
      {grouped.length > 0 ? (
        <div className="flex flex-col gap-10">
          {grouped.map(({ workspace, items }) => (
            <section key={workspace.id} aria-labelledby={`ws-${workspace.slug}`}>
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: workspace.color }}
                  aria-hidden="true"
                />
                <h2
                  id={`ws-${workspace.slug}`}
                  className="text-sm font-semibold tracking-tight text-[color:var(--text)]"
                >
                  {workspace.name}
                </h2>
                <span className="text-xs text-[color:var(--text-mute)]">
                  {items.length} proyecto{items.length !== 1 ? "s" : ""}
                </span>
                <div
                  className="flex-1 h-px ml-2"
                  style={{ backgroundColor: "var(--border)" }}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    workspace={workspaceMap.get(project.workspace_id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <FolderOpen
            className="w-10 h-10 text-[color:var(--text-mute)]"
            aria-hidden="true"
          />
          <p className="text-sm text-[color:var(--text-dim)]">
            Sin proyectos en esta categoría.
          </p>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            Crear uno nuevo
          </Button>
        </div>
      )}

      <NewProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        workspaces={workspaces}
      />
    </div>
  );
}
