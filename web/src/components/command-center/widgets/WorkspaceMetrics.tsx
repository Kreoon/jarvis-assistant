import { STATUS_COLORS } from "@/lib/tasks/types";
import type { Task, Workspace } from "@/lib/tasks/types";

interface WorkspaceMetricsProps {
  tasks: Task[];
  workspaces: Workspace[];
}

function countByStatus(tasks: Task[]) {
  return {
    backlog: tasks.filter((t) => t.status === "backlog").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    review: tasks.filter((t) => t.status === "review").length,
    done: tasks.filter((t) => t.status === "done").length,
  };
}

export function WorkspaceMetrics({ tasks, workspaces }: WorkspaceMetricsProps) {
  if (workspaces.length === 0) return null;

  return (
    <div>
      <p className="text-[9px] text-jarvis-cyan/40 tracking-widest uppercase mb-3">
        Workspaces
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {workspaces.map((ws) => {
          const wsTasks = tasks.filter((t) => t.workspace_id === ws.id);
          const counts = countByStatus(wsTasks);
          const total = wsTasks.length;

          return (
            <div
              key={ws.id}
              className="glass-panel p-4 relative"
              style={{ borderTopColor: ws.color, borderTopWidth: 2 }}
              aria-label={`Métricas de ${ws.name}`}
            >
              <div className="hud-border hud-tl" style={{ borderColor: ws.color }} />
              <div className="hud-border hud-br" style={{ borderColor: ws.color }} />

              {/* Nombre del workspace */}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: ws.color, boxShadow: `0 0 6px ${ws.color}` }}
                  aria-hidden="true"
                />
                <p
                  className="text-[10px] font-bold tracking-widest uppercase truncate"
                  style={{ color: ws.color }}
                >
                  {ws.name}
                </p>
                <span className="ml-auto text-[10px] text-jarvis-cyan/30 font-bold flex-shrink-0">
                  {total}
                </span>
              </div>

              {/* Barra de progreso */}
              {total > 0 && (
                <div className="w-full h-1 bg-jarvis-cyan/10 rounded-full mb-3 overflow-hidden flex">
                  {(["backlog", "in_progress", "review", "done"] as const).map(
                    (status) => {
                      const pct = (counts[status] / total) * 100;
                      if (pct === 0) return null;
                      return (
                        <div
                          key={status}
                          style={{
                            width: `${pct}%`,
                            backgroundColor: STATUS_COLORS[status],
                          }}
                          aria-label={`${status}: ${counts[status]}`}
                        />
                      );
                    }
                  )}
                </div>
              )}

              {/* Counters */}
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    { key: "backlog", label: "BKL" },
                    { key: "in_progress", label: "WIP" },
                    { key: "review", label: "REV" },
                    { key: "done", label: "DNE" },
                  ] as const
                ).map(({ key, label }) => (
                  <div key={key} className="flex flex-col items-center">
                    <span
                      className="text-sm font-bold tabular-nums"
                      style={{ color: STATUS_COLORS[key] }}
                    >
                      {counts[key]}
                    </span>
                    <span className="text-[8px] text-jarvis-cyan/25 tracking-widest">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
