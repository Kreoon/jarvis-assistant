import { getTasks, getWorkspaces } from "@/lib/tasks/actions";
import { TaskList } from "@/components/command-center/list/TaskList";

export default async function ListPage() {
  const [tasks, workspaces] = await Promise.all([
    getTasks({ includeDone: false }),
    getWorkspaces(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <p className="text-[9px] text-jarvis-cyan/40 tracking-[0.3em] uppercase font-bold">
          Gestión de tareas
        </p>
        <h1 className="text-lg text-jarvis-cyan tracking-widest glowing-text font-bold mt-0.5">
          LISTA
        </h1>
      </div>

      <TaskList tasks={tasks} workspaces={workspaces} />
    </div>
  );
}
