"use client";

import { useState } from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import type { ProjectWithStats } from "@/lib/projects/types";
import type { Workspace } from "@/lib/tasks/types";

interface ProjectsClientProps {
  projects: ProjectWithStats[];
  workspaces: Workspace[];
}

export function ProjectsClient({ projects, workspaces }: ProjectsClientProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const workspaceMap = new Map(workspaces.map((ws) => [ws.id, ws]));

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[color:var(--text)]">
            Proyectos
          </h1>
          <p className="text-sm text-[color:var(--text-dim)] mt-0.5">
            {projects.length} proyecto{projects.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          Nuevo proyecto
        </Button>
      </div>

      {/* Grid */}
      {projects.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              workspace={workspaceMap.get(project.workspace_id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <FolderOpen
            className="w-10 h-10 text-[color:var(--text-mute)]"
            aria-hidden="true"
          />
          <p className="text-sm text-[color:var(--text-dim)]">
            Sin proyectos todavía.
          </p>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            Crear el primero
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
