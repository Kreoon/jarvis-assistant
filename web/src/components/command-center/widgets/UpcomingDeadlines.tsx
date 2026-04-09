import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Clock } from "lucide-react";
import type { Task, Workspace } from "@/lib/tasks/types";

interface UpcomingDeadlinesProps {
  tasks: Task[];
  workspaces?: Workspace[];
}

export function UpcomingDeadlines({ tasks, workspaces = [] }: UpcomingDeadlinesProps) {
  const upcoming = tasks
    .filter((t) => t.due_date && t.status !== "done" && !t.deleted_at)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))
    .slice(0, 5);

  return (
    <div className="glass-panel p-4">
      <div className="hud-border hud-tl" />
      <div className="hud-border hud-br" />

      <h3 className="text-[10px] text-jarvis-cyan/60 tracking-[0.3em] uppercase font-bold mb-3 flex items-center gap-2">
        <Clock className="w-3 h-3" />
        Próximos deadlines
      </h3>

      {upcoming.length === 0 ? (
        <p className="text-[10px] text-jarvis-cyan/30 tracking-widest uppercase">
          Sin deadlines próximos
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {upcoming.map((task) => {
            const ws = workspaces.find((w) => w.id === task.workspace_id);
            const when = formatDistanceToNow(parseISO(task.due_date!), {
              addSuffix: true,
              locale: es,
            });
            return (
              <li
                key={task.id}
                className="flex items-center gap-2 text-xs text-white/80"
              >
                {ws && (
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: ws.color }}
                    aria-hidden="true"
                  />
                )}
                <span className="flex-1 truncate">{task.title}</span>
                <span className="text-[9px] text-jarvis-cyan/50 tracking-wide">
                  {when}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
