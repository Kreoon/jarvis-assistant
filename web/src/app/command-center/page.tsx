import Link from "next/link";
import { Kanban, List, Focus } from "lucide-react";
import { getTasks, getWorkspaces } from "@/lib/tasks/actions";
import { WorkspaceMetrics } from "@/components/command-center/widgets/WorkspaceMetrics";
import { UpcomingDeadlines } from "@/components/command-center/widgets/UpcomingDeadlines";
import { ActivityChart } from "@/components/command-center/widgets/ActivityChart";

export default async function CommandCenterPage() {
  const [tasks, workspaces] = await Promise.all([
    getTasks({ includeDone: true }),
    getWorkspaces(),
  ]);

  const quickActions = [
    {
      href: "/command-center/board",
      icon: Kanban,
      label: "Board",
      desc: "Vista kanban por columnas",
      color: "#00e5ff",
    },
    {
      href: "/command-center/list",
      icon: List,
      label: "Lista",
      desc: "Tareas ordenadas por fecha",
      color: "#a855f7",
    },
    {
      href: "/command-center/focus",
      icon: Focus,
      label: "Modo Foco",
      desc: "Una tarea a la vez + Pomodoro",
      color: "#10b981",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <p className="text-[9px] text-jarvis-cyan/40 tracking-[0.3em] uppercase font-bold">
          Sistema operativo
        </p>
        <h1 className="text-lg text-jarvis-cyan tracking-widest glowing-text font-bold mt-0.5">
          DASHBOARD
        </h1>
      </div>

      {/* Métricas por workspace */}
      <WorkspaceMetrics tasks={tasks} workspaces={workspaces} />

      {/* Segunda fila: deadlines + actividad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UpcomingDeadlines tasks={tasks} />
        <ActivityChart tasks={tasks} />
      </div>

      {/* Acciones rápidas */}
      <div>
        <p className="text-[9px] text-jarvis-cyan/40 tracking-widest uppercase mb-3">
          Acciones rápidas
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {quickActions.map(({ href, icon: Icon, label, desc, color }) => (
            <Link
              key={href}
              href={href}
              className="glass-panel p-4 flex items-center gap-4 hover:border-jarvis-cyan/40 hover:shadow-[0_0_20px_rgba(0,229,255,0.1)] transition-all duration-200 group"
              aria-label={`Ir a ${label}`}
            >
              <div className="hud-border hud-tl" />
              <div className="hud-border hud-br" />
              <span
                className="w-9 h-9 flex items-center justify-center rounded-sm flex-shrink-0"
                style={{
                  backgroundColor: `${color}15`,
                  border: `1px solid ${color}30`,
                  color,
                }}
                aria-hidden="true"
              >
                <Icon className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p
                  className="text-xs font-bold tracking-widest uppercase"
                  style={{ color }}
                >
                  {label}
                </p>
                <p className="text-[10px] text-jarvis-cyan/40 mt-0.5 truncate">
                  {desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
