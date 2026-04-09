// Tipos alineados al schema SQL del Command Center

export type TaskStatus = 'backlog' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskSource = 'web' | 'whatsapp' | 'n8n' | 'calendar' | 'api';
export type WebhookStatus = 'success' | 'error';

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
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
  source: TaskSource;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
}

export interface DailyFocus {
  id: string;
  date: string; // YYYY-MM-DD
  selected_task_id: string | null;
  pomodoros_completed: number;
  minutes_focused: number;
  notes: string | null;
  created_at: string;
}

export interface WebhookLog {
  id: string;
  source: string;
  action: string;
  payload: Record<string, unknown>;
  response: Record<string, unknown> | null;
  status: WebhookStatus;
  error: string | null;
  created_at: string;
}

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateTaskInput {
  title: string;
  workspaceSlug: string;
  priority?: TaskPriority;
  dueDate?: string;
  description?: string;
  tags?: string[];
  source: TaskSource;
}

export interface TaskFilter {
  workspaceSlug?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueBefore?: string;
  includeCompleted?: boolean;
}

export interface MoveTaskInput {
  status: TaskStatus;
  position?: number;
}

// ─── Report types ─────────────────────────────────────────────────────────────

export interface WorkspaceTaskSummary {
  workspace: string;
  completed: number;
  tasks: { title: string; completed_at: string }[];
}

export interface WeeklyReport {
  weekLabel: string;    // e.g. "2026-W15"
  startDate: string;
  endDate: string;
  totalCompleted: number;
  byWorkspace: WorkspaceTaskSummary[];
}
