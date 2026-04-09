export type TaskStatus = "backlog" | "in_progress" | "review" | "done";
export type TaskPriority = "urgent" | "high" | "medium" | "low";

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  icon: string;
  color: string;
  sort_order: number;
}

export interface Task {
  id: string;
  workspace_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  position: number;
  due_date: string | null;
  tags: string[];
  pomodoros_completed: number;
  google_event_id: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
}

export interface DailyFocus {
  id: string;
  date: string; // ISO date string "YYYY-MM-DD"
  top_task_ids: string[];
  note: string | null;
  created_at: string;
}

// Colores por prioridad — TDA-friendly
export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#6b7280",
};

// Colores por status
export const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "#6b7280",
  in_progress: "#00e5ff",
  review: "#a855f7",
  done: "#10b981",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  in_progress: "En curso",
  review: "En revisión",
  done: "Listo",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

export interface CreateTaskInput {
  title: string;
  workspaceSlug: string;
  priority?: TaskPriority;
  dueDate?: string;
  description?: string;
}

export interface TaskFilter {
  workspaceSlug?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  includeCompleted?: boolean;
  includeDone?: boolean;
}
