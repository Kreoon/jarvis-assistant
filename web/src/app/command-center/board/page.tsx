import { getTasks, getWorkspaces } from "@/lib/tasks/actions";
import { Board } from "@/components/command-center/kanban/Board";

export default async function BoardPage() {
  const [tasks, workspaces] = await Promise.all([
    getTasks(),
    getWorkspaces(),
  ]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div>
        <p className="text-[9px] text-jarvis-cyan/40 tracking-[0.3em] uppercase font-bold">
          Gestión de tareas
        </p>
        <h1 className="text-lg text-jarvis-cyan tracking-widest glowing-text font-bold mt-0.5">
          BOARD
        </h1>
      </div>

      <Board initialTasks={tasks} workspaces={workspaces} />
    </div>
  );
}
