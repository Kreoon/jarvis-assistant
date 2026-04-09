"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Archive, Edit2, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { archiveProject, updateProject } from "@/lib/projects/actions";
import { createTask } from "@/lib/tasks/actions";
import {
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_LABELS,
} from "@/lib/projects/types";
import {
  STATUS_LABELS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
} from "@/lib/tasks/types";
import type { Project } from "@/lib/projects/types";
import type { Task, TaskStatus, Workspace } from "@/lib/tasks/types";
import { cn } from "@/lib/cn";

const STATUS_ORDER: TaskStatus[] = ["backlog", "in_progress", "review", "done"];

interface ProjectDetailClientProps {
  project: Project;
  tasks: Task[];
  stats: { total: number; done: number; progress: number };
  workspaces: Workspace[];
}

export function ProjectDetailClient({
  project,
  tasks,
  stats,
  workspaces,
}: ProjectDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const workspace = workspaces.find((ws) => ws.id === project.workspace_id);
  const statusColor = PROJECT_STATUS_COLORS[project.status];

  const tasksByStatus = STATUS_ORDER.reduce<Record<TaskStatus, Task[]>>(
    (acc, status) => {
      acc[status] = tasks.filter((t) => t.status === status);
      return acc;
    },
    { backlog: [], in_progress: [], review: [], done: [] }
  );

  const handleArchive = () => {
    startTransition(async () => {
      await archiveProject(project.id);
      router.push("/projects");
    });
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim() || !workspace) return;
    startTransition(async () => {
      await createTask({
        title: newTaskTitle.trim(),
        workspaceSlug: workspace.slug,
      });
      setNewTaskTitle("");
      setAddingTask(false);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      {/* Back */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-xs text-[color:var(--text-dim)] hover:text-[color:var(--text)] transition-colors w-fit"
      >
        <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        Proyectos
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-[color:var(--text)] truncate">
              {project.name}
            </h1>
            {workspace ? (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0"
                style={{
                  color: workspace.color,
                  backgroundColor: `${workspace.color}15`,
                  border: `1px solid ${workspace.color}30`,
                }}
              >
                {workspace.icon} {workspace.name}
              </span>
            ) : null}
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
          {project.description ? (
            <div className="text-sm text-[color:var(--text-dim)] leading-relaxed prose-invert max-w-none [&_strong]:text-[color:var(--text)] [&_strong]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:pl-5 [&_ul]:list-disc [&_li]:my-0.5 [&_code]:text-[color:var(--accent)] [&_code]:bg-[color:var(--surface-solid)] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {project.description}
              </ReactMarkdown>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Editar proyecto"
            onClick={() => {
              /* TODO: abrir EditProjectDialog */
            }}
          >
            <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
            Editar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            loading={isPending}
            onClick={handleArchive}
            aria-label="Archivar proyecto"
          >
            <Archive className="w-3.5 h-3.5" aria-hidden="true" />
            Archivar
          </Button>
        </div>
      </div>

      {/* Barra de progreso */}
      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-[color:var(--text)]">
            Progreso
          </span>
          <span className="text-[color:var(--text-dim)]">
            {stats.done}/{stats.total} tareas completadas
          </span>
        </div>
        <div
          className="h-2 rounded-full bg-[color:var(--border)] overflow-hidden"
          role="progressbar"
          aria-valuenow={stats.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progreso del proyecto: ${stats.progress}%`}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${stats.progress}%`,
              backgroundColor:
                stats.progress === 100 ? "var(--success)" : "var(--accent)",
            }}
          />
        </div>
        <p className="text-xs text-[color:var(--text-mute)] text-right">
          {stats.progress}%
        </p>
      </Card>

      {/* Tasks por status */}
      <div className="flex flex-col gap-6">
        {STATUS_ORDER.map((status) => {
          const statusTasks = tasksByStatus[status];
          if (statusTasks.length === 0 && status === "done") return null;
          return (
            <section key={status} aria-label={STATUS_LABELS[status]}>
              <h2 className="text-xs font-semibold text-[color:var(--text-dim)] uppercase tracking-widest mb-3">
                {STATUS_LABELS[status]}{" "}
                <span className="text-[color:var(--text-mute)]">
                  ({statusTasks.length})
                </span>
              </h2>
              {statusTasks.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {statusTasks.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => setSelectedTask(task)}
                      className={cn(
                        "w-full text-left rounded-[var(--radius-md)] p-3",
                        "bg-[color:var(--surface-solid)] border border-[color:var(--border)]",
                        "hover:border-[color:var(--border-strong)] transition-all duration-200",
                        "focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]"
                      )}
                      aria-label={`Tarea: ${task.title}`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0"
                          style={{
                            backgroundColor: PRIORITY_COLORS[task.priority],
                          }}
                          aria-hidden="true"
                        />
                        <span className="text-sm text-[color:var(--text)] leading-snug flex-1 min-w-0">
                          {task.title}
                        </span>
                        <span
                          className="text-[10px] shrink-0"
                          style={{ color: PRIORITY_COLORS[task.priority] }}
                        >
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                      </div>
                      {task.description ? (
                        <p className="text-xs text-[color:var(--text-mute)] mt-1.5 ml-3.5 line-clamp-1">
                          {task.description}
                        </p>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[color:var(--text-mute)] py-2 px-3">
                  Sin tareas
                </p>
              )}
            </section>
          );
        })}
      </div>

      {/* Añadir tarea */}
      <div className="border-t border-[color:var(--border)] pt-4">
        {addingTask ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddTask();
                if (e.key === "Escape") {
                  setAddingTask(false);
                  setNewTaskTitle("");
                }
              }}
              placeholder="Título de la nueva tarea..."
              autoFocus
              className={cn(
                "flex-1 h-9 px-3 text-sm",
                "bg-[color:var(--surface-solid)] text-[color:var(--text)]",
                "border border-[color:var(--border)] rounded-[var(--radius-md)]",
                "placeholder:text-[color:var(--text-mute)]",
                "focus:outline-none focus:border-[color:var(--accent)]",
                "transition-colors duration-200"
              )}
            />
            <Button size="sm" loading={isPending} onClick={handleAddTask}>
              Añadir
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAddingTask(false);
                setNewTaskTitle("");
              }}
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAddingTask(true)}
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            Añadir tarea
          </Button>
        )}
      </div>

      {/* Task detail panel (inline) */}
      {selectedTask ? (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4 sm:p-6"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setSelectedTask(null)}
          aria-modal="true"
          role="dialog"
          aria-label={`Detalle: ${selectedTask.title}`}
        >
          <Card
            className="w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-[color:var(--text)] leading-snug">
                  {selectedTask.title}
                </h3>
                <button
                  onClick={() => setSelectedTask(null)}
                  aria-label="Cerrar"
                  className="text-[color:var(--text-mute)] hover:text-[color:var(--text)] transition-colors shrink-0"
                >
                  ✕
                </button>
              </div>
              {selectedTask.description ? (
                <p className="text-xs text-[color:var(--text-dim)] leading-relaxed">
                  {selectedTask.description}
                </p>
              ) : null}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="neutral">
                  {STATUS_LABELS[selectedTask.status]}
                </Badge>
                <span
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full border"
                  style={{
                    color: PRIORITY_COLORS[selectedTask.priority],
                    backgroundColor: `${PRIORITY_COLORS[selectedTask.priority]}15`,
                    borderColor: `${PRIORITY_COLORS[selectedTask.priority]}30`,
                  }}
                >
                  {PRIORITY_LABELS[selectedTask.priority]}
                </span>
                {selectedTask.due_date ? (
                  <span className="text-[11px] text-[color:var(--text-mute)]">
                    Vence: {selectedTask.due_date}
                  </span>
                ) : null}
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
