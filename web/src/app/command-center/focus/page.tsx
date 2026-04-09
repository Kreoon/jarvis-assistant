import { getTasks, getTodayTasks } from "@/lib/tasks/actions";
import { FocusView } from "@/components/command-center/focus/FocusView";

export default async function FocusPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { task: taskIdParam } = await searchParams;
  const taskId = Array.isArray(taskIdParam) ? taskIdParam[0] : taskIdParam;

  const [todayTasks, inProgressTasks] = await Promise.all([
    getTodayTasks(),
    getTasks({ status: "in_progress" }),
  ]);

  // Construir la queue unificada sin duplicados
  const seen = new Set<string>();
  const queue = [...todayTasks, ...inProgressTasks].filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  // Si hay un taskId en la URL lo ponemos primero
  let initialTask = queue[0] ?? null;
  if (taskId) {
    const found = queue.find((t) => t.id === taskId);
    if (found) {
      initialTask = found;
    }
  }

  return (
    <FocusView
      initialTask={initialTask}
      queue={queue}
    />
  );
}
