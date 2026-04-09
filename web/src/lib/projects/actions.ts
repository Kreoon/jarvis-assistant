"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Project, ProjectWithStats } from "./types";
import type { Task } from "@/lib/tasks/types";

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function listProjects(filter?: {
  workspaceId?: string;
  status?: string;
}): Promise<ProjectWithStats[]> {
  let query = supabaseAdmin
    .from("projects")
    .select("*")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (filter?.workspaceId) {
    query = query.eq("workspace_id", filter.workspaceId);
  }
  if (filter?.status) {
    query = query.eq("status", filter.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`listProjects: ${error.message}`);

  const projects = (data ?? []) as Project[];

  // Para cada proyecto calcula estadísticas de tasks
  const withStats = await Promise.all(
    projects.map(async (project) => {
      const { data: tasks, error: taskError } = await supabaseAdmin
        .from("tasks")
        .select("id, status")
        .eq("project_id", project.id)
        .is("deleted_at", null);

      if (taskError) {
        return { ...project, total_tasks: 0, done_tasks: 0, progress: 0 };
      }

      const total = tasks?.length ?? 0;
      const done = tasks?.filter((t) => t.status === "done").length ?? 0;
      const progress = total > 0 ? Math.round((done / total) * 100) : 0;

      return { ...project, total_tasks: total, done_tasks: done, progress };
    })
  );

  return withStats;
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`getProject: ${error.message}`);
  return data as Project | null;
}

export async function getProjectWithTasks(id: string): Promise<{
  project: Project;
  tasks: Task[];
  stats: { total: number; done: number; progress: number };
} | null> {
  const project = await getProject(id);
  if (!project) return null;

  const { data: tasks, error } = await supabaseAdmin
    .from("tasks")
    .select("*")
    .eq("project_id", id)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  if (error) throw new Error(`getProjectWithTasks: ${error.message}`);

  const allTasks = (tasks ?? []) as Task[];
  const done = allTasks.filter((t) => t.status === "done").length;
  const total = allTasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;

  return { project, tasks: allTasks, stats: { total, done, progress } };
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createProject(input: {
  workspaceId: string;
  name: string;
  description?: string;
}): Promise<Project> {
  const { data, error } = await supabaseAdmin
    .from("projects")
    .insert({
      workspace_id: input.workspaceId,
      name: input.name,
      description: input.description ?? null,
      status: "active",
    })
    .select()
    .single();

  if (error) throw new Error(`createProject: ${error.message}`);
  revalidatePath("/projects");
  return data as Project;
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, "name" | "description" | "status" | "workspace_id">>
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("projects")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`updateProject: ${error.message}`);
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
}

export async function archiveProject(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("projects")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`archiveProject: ${error.message}`);
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
}
