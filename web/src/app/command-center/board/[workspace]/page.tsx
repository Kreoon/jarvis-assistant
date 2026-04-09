import { getTasks, getWorkspaces } from "@/lib/tasks/actions";
import { Board } from "@/components/command-center/kanban/Board";

export default async function WorkspaceBoardPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;

  const [tasks, workspaces] = await Promise.all([
    getTasks({ workspaceSlug: workspace }),
    getWorkspaces(),
  ]);

  const currentWorkspace = workspaces.find((w) => w.slug === workspace);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div>
        <p className="text-[9px] text-jarvis-cyan/40 tracking-[0.3em] uppercase font-bold">
          Workspace
        </p>
        <h1
          className="text-lg tracking-widest font-bold mt-0.5"
          style={{ color: currentWorkspace?.color ?? "#00e5ff" }}
        >
          {(currentWorkspace?.name ?? workspace).toUpperCase()}
        </h1>
      </div>

      <Board
        initialTasks={tasks}
        workspaces={workspaces}
        workspaceFilter={workspace}
      />
    </div>
  );
}
