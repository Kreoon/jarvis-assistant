export type ProjectStatus = "active" | "paused" | "done" | "archived";

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProjectWithStats extends Project {
  total_tasks: number;
  done_tasks: number;
  progress: number; // 0-100
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Activo",
  paused: "Pausado",
  done: "Listo",
  archived: "Archivado",
};

export const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  active: "#30d158",
  paused: "#ff9f0a",
  done: "#5e8eff",
  archived: "#6b7280",
};
