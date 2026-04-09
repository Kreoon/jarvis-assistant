"use client";

import { useState, useCallback, useEffect, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import { moveTask } from "@/lib/tasks/actions";
import { useTasksRealtime } from "@/hooks/useTasksRealtime";
import type { Task, TaskStatus, Workspace } from "@/lib/tasks/types";
import { Column } from "./Column";
import { TaskCard } from "./TaskCard";
import { TaskSheet } from "./TaskSheet";
import { Filters } from "./Filters";

const COLUMNS: TaskStatus[] = ["backlog", "in_progress", "review", "done"];

interface BoardProps {
  initialTasks: Task[];
  workspaces: Workspace[];
  workspaceFilter?: string;
}

export function Board({ initialTasks, workspaces, workspaceFilter }: BoardProps) {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Realtime: refresh on external changes
  useTasksRealtime({
    onChange: useCallback(() => {
      router.refresh();
    }, [router]),
  });

  // Resync local state whenever server pushes new tasks (after router.refresh or navigation)
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const handleDragStart = (e: DragStartEvent) => {
    const t = tasks.find((x) => x.id === e.active.id);
    if (t) setActiveTask(t);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = e;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = tasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    // Determine destination status: overId may be a column id or a task id
    const isColumn = (COLUMNS as string[]).includes(overId);
    const overTask = !isColumn ? tasks.find((t) => t.id === overId) : null;
    const destStatus: TaskStatus = isColumn
      ? (overId as TaskStatus)
      : overTask?.status ?? activeTask.status;

    // Compute new position: append to end of destination column unless over a specific task
    const destTasks = tasks
      .filter((t) => t.status === destStatus && t.id !== activeId)
      .sort((a, b) => a.position - b.position);

    let newPosition: number;
    if (overTask && overTask.status === destStatus) {
      const overIndex = destTasks.findIndex((t) => t.id === overTask.id);
      const prev = destTasks[overIndex - 1]?.position ?? 0;
      const next = destTasks[overIndex]?.position ?? prev + 2000;
      newPosition = (prev + next) / 2;
    } else {
      const last = destTasks[destTasks.length - 1]?.position ?? 0;
      newPosition = last + 1000;
    }

    // Optimistic update
    setTasks((curr) =>
      curr.map((t) =>
        t.id === activeId ? { ...t, status: destStatus, position: newPosition } : t
      )
    );

    startTransition(async () => {
      try {
        await moveTask(activeId, destStatus, newPosition);
      } catch (err) {
        console.error("moveTask failed", err);
        // Rollback on error
        setTasks(initialTasks);
      }
    });
  };

  const handleOpenTask = (task: Task) => setSelectedTask(task);
  const handleCloseSheet = () => setSelectedTask(null);
  const handleTaskUpdated = (updated: Task) => {
    setTasks((curr) => curr.map((t) => (t.id === updated.id ? updated : t)));
    setSelectedTask(updated);
  };
  const handleTaskDeleted = (id: string) => {
    setTasks((curr) => curr.filter((t) => t.id !== id));
    setSelectedTask(null);
  };

  const tasksByStatus = (status: TaskStatus) =>
    tasks
      .filter((t) => t.status === status)
      .sort((a, b) => a.position - b.position);

  return (
    <div className="flex flex-col gap-3 h-full">
      <Filters workspaces={workspaces} activeWorkspace={workspaceFilter} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          className="flex gap-3 overflow-x-auto custom-scrollbar pb-3 flex-1"
          role="region"
          aria-label="Tablero kanban"
        >
          {COLUMNS.map((status) => (
            <Column
              key={status}
              status={status}
              tasks={tasksByStatus(status)}
              workspaces={workspaces}
              onOpenTask={handleOpenTask}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <TaskCard
              task={activeTask}
              workspace={workspaces.find((w) => w.id === activeTask.workspace_id)}
              onOpen={() => {}}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskSheet
        task={selectedTask}
        workspaces={workspaces}
        onClose={handleCloseSheet}
        onTaskUpdated={handleTaskUpdated}
        onTaskDeleted={handleTaskDeleted}
      />
    </div>
  );
}
