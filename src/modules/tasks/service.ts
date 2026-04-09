import Fuse from 'fuse.js';
import { supabaseAdmin } from '../../connectors/supabase.js';
import { logger } from '../../shared/logger.js';
import type {
  Task,
  Workspace,
  TaskFilter,
  CreateTaskInput,
  MoveTaskInput,
  WeeklyReport,
  WorkspaceTaskSummary,
  WebhookStatus,
} from './types.js';

const log = logger.child({ module: 'task-service' });

// ─── Hook: onTaskCompleted ────────────────────────────────────────────────────

type TaskCompletedHook = (task: Task) => Promise<void>;
const completedHooks: TaskCompletedHook[] = [];

export function registerOnTaskCompleted(fn: TaskCompletedHook): void {
  completedHooks.push(fn);
}

async function fireOnTaskCompleted(task: Task): Promise<void> {
  for (const hook of completedHooks) {
    await hook(task).catch((err: Error) =>
      log.warn({ error: err.message }, 'onTaskCompleted hook failed'),
    );
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function requireAdmin() {
  if (!supabaseAdmin) throw new Error('Supabase admin client not initialized');
  return supabaseAdmin;
}

async function resolveWorkspaceId(slug: string): Promise<string> {
  const sb = requireAdmin();
  const { data, error } = await sb
    .from('workspaces')
    .select('id')
    .eq('slug', slug)
    .single();
  if (error || !data) throw new Error(`Workspace "${slug}" not found`);
  return data.id as string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function listWorkspaces(): Promise<Workspace[]> {
  const sb = requireAdmin();
  const { data, error } = await sb
    .from('workspaces')
    .select('*')
    .order('sort_order');
  if (error) throw new Error(error.message);
  return (data ?? []) as Workspace[];
}

export async function listTasks(filter: TaskFilter = {}): Promise<Task[]> {
  const sb = requireAdmin();
  let query = sb
    .from('tasks')
    .select('*')
    .is('deleted_at', null)
    .order('position');

  if (filter.workspaceSlug) {
    const wsId = await resolveWorkspaceId(filter.workspaceSlug);
    query = query.eq('workspace_id', wsId);
  }
  if (filter.status) {
    query = query.eq('status', filter.status);
  }
  if (filter.priority) {
    query = query.eq('priority', filter.priority);
  }
  if (filter.dueBefore) {
    query = query.lte('due_date', filter.dueBefore);
  }
  if (!filter.includeCompleted) {
    query = query.neq('status', 'done');
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Task[];
}

export async function getTask(id: string): Promise<Task | null> {
  const sb = requireAdmin();
  const { data, error } = await sb
    .from('tasks')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  if (error) return null;
  return data as Task;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const sb = requireAdmin();
  const wsId = await resolveWorkspaceId(input.workspaceSlug);

  // Calcular la siguiente posición en backlog
  const { data: lastTask } = await sb
    .from('tasks')
    .select('position')
    .eq('workspace_id', wsId)
    .eq('status', 'backlog')
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1)
    .single();

  const position = lastTask ? (lastTask.position as number) + 1000 : 1000;

  const { data, error } = await sb
    .from('tasks')
    .insert({
      workspace_id: wsId,
      title: input.title,
      description: input.description ?? null,
      status: 'backlog',
      priority: input.priority ?? 'medium',
      position,
      due_date: input.dueDate ?? null,
      tags: input.tags ?? [],
      source: input.source,
      pomodoros_completed: 0,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Task;
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<Task> {
  const sb = requireAdmin();
  const { data, error } = await sb
    .from('tasks')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Task;
}

export async function moveTask(id: string, input: MoveTaskInput): Promise<Task> {
  const sb = requireAdmin();
  const task = await getTask(id);
  if (!task) throw new Error(`Task ${id} not found`);

  // Si no se especifica posición, ir al final de la columna destino
  let position = input.position;
  if (position === undefined) {
    const { data: lastTask } = await sb
      .from('tasks')
      .select('position')
      .eq('workspace_id', task.workspace_id)
      .eq('status', input.status)
      .is('deleted_at', null)
      .order('position', { ascending: false })
      .limit(1)
      .single();
    position = lastTask ? (lastTask.position as number) + 1000 : 1000;
  }

  return updateTask(id, { status: input.status, position });
}

export async function completeTask(id: string): Promise<Task> {
  const now = new Date().toISOString();
  const task = await updateTask(id, {
    status: 'done',
    completed_at: now,
  });
  await fireOnTaskCompleted(task);
  return task;
}

export async function softDelete(id: string): Promise<void> {
  const sb = requireAdmin();
  const { error } = await sb
    .from('tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function incrementPomodoro(taskId: string, date: string): Promise<void> {
  const sb = requireAdmin();

  // Incrementar contador en la tarea
  const { error: taskError } = await sb.rpc('increment_pomodoro', { task_id: taskId });
  if (taskError) {
    // Fallback manual si no existe la función RPC
    const task = await getTask(taskId);
    if (task) {
      await updateTask(taskId, {
        pomodoros_completed: task.pomodoros_completed + 1,
      });
    }
  }

  // Upsert en daily_focus
  const { data: existing } = await sb
    .from('daily_focus')
    .select('id, pomodoros_completed')
    .eq('date', date)
    .single();

  if (existing) {
    await sb
      .from('daily_focus')
      .update({ pomodoros_completed: (existing.pomodoros_completed as number) + 1 })
      .eq('id', existing.id);
  } else {
    await sb.from('daily_focus').insert({
      date,
      selected_task_id: taskId,
      pomodoros_completed: 1,
      minutes_focused: 25,
    });
  }
}

export async function getTodayTasks(): Promise<Task[]> {
  const sb = requireAdmin();
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await sb
    .from('tasks')
    .select('*')
    .is('deleted_at', null)
    .neq('status', 'done')
    .or(`due_date.eq.${today},priority.in.(urgent,high)`)
    .order('priority')
    .order('position');

  if (error) throw new Error(error.message);
  return (data ?? []) as Task[];
}

export async function findTaskFuzzy(
  query: string,
  workspaceSlug?: string,
): Promise<Task | null> {
  const tasks = await listTasks({ workspaceSlug, includeCompleted: false });

  const fuse = new Fuse(tasks, {
    keys: ['title'],
    threshold: 0.4,
    includeScore: true,
  });

  const results = fuse.search(query);
  if (!results.length) return null;

  const best = results[0];
  const score = best.score ?? 1;
  // score=0 es match perfecto, score=1 es sin match; queremos score <= 0.6 (equivale a >0.4 similitud)
  if (score > 0.6) return null;

  return best.item;
}

export async function logWebhook(
  source: string,
  action: string,
  payload: Record<string, unknown>,
  response: Record<string, unknown> | null,
  status: WebhookStatus,
  error?: string,
): Promise<void> {
  const sb = requireAdmin();
  await sb.from('webhook_logs').insert({
    source,
    action,
    payload,
    response,
    status,
    error: error ?? null,
  });
}

export async function getWeeklyReport(weekOffset = 0): Promise<WeeklyReport> {
  const sb = requireAdmin();
  const now = new Date();

  // Calcular inicio (lunes) y fin (domingo) de la semana
  const dayOfWeek = now.getDay(); // 0=dom, 1=lun ...
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek) + weekOffset * 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const startDate = monday.toISOString().split('T')[0];
  const endDate = sunday.toISOString().split('T')[0];

  // Calcular número de semana ISO
  const startOfYear = new Date(monday.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(
    ((monday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7,
  );
  const weekLabel = `${monday.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;

  const { data, error } = await sb
    .from('tasks')
    .select('title, completed_at, workspace_id, workspaces(name)')
    .eq('status', 'done')
    .gte('completed_at', monday.toISOString())
    .lte('completed_at', sunday.toISOString())
    .is('deleted_at', null);

  if (error) throw new Error(error.message);

  const rawRows = (data ?? []) as unknown as Array<{
    title: string;
    completed_at: string;
    workspace_id: string;
    workspaces: { name: string } | { name: string }[] | null;
  }>;
  const rows = rawRows.map((r) => ({
    title: r.title,
    completed_at: r.completed_at,
    workspace_id: r.workspace_id,
    workspaces: Array.isArray(r.workspaces) ? r.workspaces[0] ?? null : r.workspaces,
  }));

  // Agrupar por workspace
  const byWs = new Map<string, WorkspaceTaskSummary>();
  for (const row of rows) {
    const wsName = row.workspaces?.name ?? row.workspace_id;
    if (!byWs.has(wsName)) {
      byWs.set(wsName, { workspace: wsName, completed: 0, tasks: [] });
    }
    const entry = byWs.get(wsName)!;
    entry.completed++;
    entry.tasks.push({ title: row.title, completed_at: row.completed_at });
  }

  return {
    weekLabel,
    startDate,
    endDate,
    totalCompleted: rows.length,
    byWorkspace: Array.from(byWs.values()),
  };
}
