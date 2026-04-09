import Link from "next/link";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import {
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_LABELS,
} from "@/lib/projects/types";
import type { ProjectWithStats } from "@/lib/projects/types";
import type { Workspace } from "@/lib/tasks/types";

interface ProjectCardProps {
  project: ProjectWithStats;
  workspace: Workspace | undefined;
}

export function ProjectCard({ project, workspace }: ProjectCardProps) {
  const updatedLabel = formatDistanceToNow(parseISO(project.updated_at), {
    addSuffix: true,
    locale: es,
  });

  const statusColor = PROJECT_STATUS_COLORS[project.status];

  return (
    <Link href={`/projects/${project.id}`} className="block group">
      <Card
        className={cn(
          "flex flex-col gap-3 h-full transition-all duration-200",
          "hover:border-[color:var(--border-strong)] hover:shadow-[0_4px_24px_rgba(0,0,0,0.3)]"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-[color:var(--text)] leading-snug flex-1 min-w-0 truncate group-hover:text-[color:var(--accent)] transition-colors duration-200">
            {project.name}
          </h3>
          <Badge
            variant="neutral"
            style={{
              color: statusColor,
              backgroundColor: `${statusColor}18`,
              borderColor: `${statusColor}30`,
            }}
          >
            {PROJECT_STATUS_LABELS[project.status]}
          </Badge>
        </div>

        {/* Workspace badge */}
        {workspace ? (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium self-start"
            style={{
              color: workspace.color,
              backgroundColor: `${workspace.color}15`,
              border: `1px solid ${workspace.color}30`,
            }}
          >
            {workspace.icon} {workspace.name}
          </span>
        ) : null}

        {/* Descripción */}
        {project.description ? (
          <p className="text-xs text-[color:var(--text-dim)] leading-relaxed line-clamp-2 flex-1">
            {project.description}
          </p>
        ) : (
          <p className="text-xs text-[color:var(--text-mute)] italic flex-1">
            Sin descripción
          </p>
        )}

        {/* Barra de progreso */}
        <div className="flex flex-col gap-1.5">
          <div
            className="h-1.5 rounded-full bg-[color:var(--border)] overflow-hidden"
            role="progressbar"
            aria-valuenow={project.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progreso: ${project.progress}%`}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${project.progress}%`,
                backgroundColor:
                  project.progress === 100
                    ? "var(--success)"
                    : "var(--accent)",
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[color:var(--text-mute)]">
              {project.done_tasks}/{project.total_tasks} tareas
            </span>
            <span className="text-[11px] text-[color:var(--text-mute)]">
              {updatedLabel}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
