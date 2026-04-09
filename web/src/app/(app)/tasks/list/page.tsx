import { getTasks, getWorkspaces } from "@/lib/tasks/actions";
import { TaskList } from "@/components/command-center/list/TaskList";

export default async function TasksListPage() {
  const [tasks, workspaces] = await Promise.all([
    getTasks({ includeDone: false }),
    getWorkspaces(),
  ]);

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Lista</h1>
        <p className="text-sm text-[color:var(--text-dim)] mt-1">
          Tareas ordenadas por urgencia y fecha.
        </p>
      </div>
      <TaskList tasks={tasks} workspaces={workspaces} />
    </div>
  );
}
