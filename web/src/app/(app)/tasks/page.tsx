import { getTasks, getWorkspaces } from "@/lib/tasks/actions";
import { Board } from "@/components/command-center/kanban/Board";

export default async function TasksPage() {
  const [tasks, workspaces] = await Promise.all([getTasks(), getWorkspaces()]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Tareas</h1>
        <p className="text-sm text-[color:var(--text-dim)] mt-1">
          Arrastra las tarjetas entre columnas o usa ⌘K para captura rápida.
        </p>
      </div>
      <Board initialTasks={tasks} workspaces={workspaces} />
    </div>
  );
}
