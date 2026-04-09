"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import type {
  Task,
  TaskStatus,
  TaskPriority,
  Workspace,
  DailyFocus,
  CreateTaskInput,
  TaskFilter,
} from "./types";

// ─── Workspaces ──────────────────────────────────────────────────────────────

export async function getWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabaseAdmin
    .from("workspaces")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`getWorkspaces: ${error.message}`);
  return (data ?? []) as Workspace[];
}

// ─── Tasks — Queries ─────────────────────────────────────────────────────────

export async function getTasks(filter: TaskFilter = {}): Promise<Task[]> {
  let query = supabaseAdmin
    .from("tasks")
    .select("*, workspaces(slug)")
    .is("deleted_at", null)
    .order("position", { ascending: true });

  if (filter.workspaceSlug) {
    const { data: ws } = await supabaseAdmin
      .from("workspaces")
      .select("id")
      .eq("slug", filter.workspaceSlug)
      .single();
    if (ws) query = query.eq("workspace_id", ws.id);
  }

  if (filter.status) {
    query = query.eq("status", filter.status);
  }

  if (filter.priority) {
    query = query.eq("priority", filter.priority);
  }

  if (!filter.includeDone) {
    // Solo excluir done si no se pide explícitamente
  }

  const { data, error } = await query;
  if (error) throw new Error(`getTasks: ${error.message}`);
  return (data ?? []) as Task[];
}

export async function getTodayTasks(): Promise<Task[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .select("*")
    .is("deleted_at", null)
    .neq("status", "done")
    .or(`due_date.eq.${today},priority.eq.urgent`)
    .order("priority", { ascending: true })
    .order("due_date", { ascending: true })
    .limit(10);

  if (error) throw new Error(`getTodayTasks: ${error.message}`);
  return (data ?? []) as Task[];
}

// ─── Tasks — Mutations ───────────────────────────────────────────────────────

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const { workspaceSlug, title, priority = "medium", dueDate, description } =
    input;

  // Obtener workspace_id desde slug
  const { data: ws, error: wsError } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("slug", workspaceSlug)
    .single();

  if (wsError || !ws) {
    throw new Error(`Workspace not found: ${workspaceSlug}`);
  }

  // Calcular siguiente posición en backlog
  const { count } = await supabaseAdmin
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", ws.id)
    .eq("status", "backlog")
    .is("deleted_at", null);

  const position = (count ?? 0) * 1000;

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .insert({
      workspace_id: ws.id,
      title,
      priority,
      description: description ?? null,
      due_date: dueDate ?? null,
      status: "backlog" as TaskStatus,
      position,
      tags: [],
      pomodoros_completed: 0,
      source: "web",
    })
    .select()
    .single();

  if (error) throw new Error(`createTask: ${error.message}`);

  revalidatePath("/command-center");
  return data as Task;
}

export async function updateTaskStatus(
  id: string,
  status: TaskStatus
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("tasks")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`updateTaskStatus: ${error.message}`);
  revalidatePath("/command-center");
}

export async function moveTask(
  id: string,
  status: TaskStatus,
  position: number
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("tasks")
    .update({
      status,
      position,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(`moveTask: ${error.message}`);
  revalidatePath("/command-center");
}

export async function reorderTasks(
  taskIds: string[],
  status: TaskStatus
): Promise<void> {
  const updates = taskIds.map((id, index) => ({
    id,
    status,
    position: index * 1000,
    updated_at: new Date().toISOString(),
  }));

  for (const update of updates) {
    const { error } = await supabaseAdmin
      .from("tasks")
      .update({ position: update.position, updated_at: update.updated_at })
      .eq("id", update.id);
    if (error) throw new Error(`reorderTasks: ${error.message}`);
  }

  revalidatePath("/command-center");
}

export async function completeTask(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("tasks")
    .update({
      status: "done" as TaskStatus,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(`completeTask: ${error.message}`);
  revalidatePath("/command-center");
}

export async function incrementPomodoro(taskId: string): Promise<void> {
  const { data: task, error: fetchError } = await supabaseAdmin
    .from("tasks")
    .select("pomodoros_completed")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) throw new Error(`incrementPomodoro: task not found`);

  const { error } = await supabaseAdmin
    .from("tasks")
    .update({
      pomodoros_completed: (task.pomodoros_completed as number) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) throw new Error(`incrementPomodoro: ${error.message}`);
  revalidatePath("/command-center");
}

export async function softDeleteTask(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("tasks")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(`softDeleteTask: ${error.message}`);
  revalidatePath("/command-center");
}

export async function updateTask(
  id: string,
  updates: Partial<
    Pick<Task, "title" | "description" | "priority" | "due_date" | "tags" | "workspace_id">
  >
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("tasks")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`updateTask: ${error.message}`);
  revalidatePath("/command-center");
}

// ─── Daily Focus ─────────────────────────────────────────────────────────────

export async function getTodayFocus(): Promise<DailyFocus | null> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabaseAdmin
    .from("daily_focus")
    .select("*")
    .eq("date", today)
    .maybeSingle();

  if (error) throw new Error(`getTodayFocus: ${error.message}`);
  return data as DailyFocus | null;
}

export async function setDailyFocus(topTaskIds: string[]): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  const { error } = await supabaseAdmin.from("daily_focus").upsert(
    {
      date: today,
      top_task_ids: topTaskIds,
    },
    { onConflict: "date" }
  );

  if (error) throw new Error(`setDailyFocus: ${error.message}`);
  revalidatePath("/command-center");
}
