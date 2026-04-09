import { getTasks, getWorkspaces } from "@/lib/tasks/actions";
import { Board } from "@/components/command-center/kanban/Board";

export default async function WorkspaceTasksPage({
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
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10">
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-widest text-[color:var(--text-mute)] font-medium">
          Workspace
        </p>
        <h1
          className="text-2xl font-semibold tracking-tight mt-1"
          style={{ color: currentWorkspace?.color ?? "var(--text)" }}
        >
          {currentWorkspace?.name ?? workspace}
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
