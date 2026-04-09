export const dynamic = "force-dynamic";

import { getWorkspaces } from "@/lib/tasks/actions";
import { getTodayTasks, getTodayFocus } from "@/lib/tasks/actions";
import { Sidebar } from "@/components/command-center/Sidebar";
import { QuickCapture } from "@/components/command-center/kanban/QuickCapture";
import { DailyBanner } from "@/components/command-center/standup/DailyBanner";

export default async function CommandCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [workspaces, todayTasks, existingFocus] = await Promise.all([
    getWorkspaces(),
    getTodayTasks(),
    getTodayFocus(),
  ]);

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#000810]">
      {/* Scanline effect */}
      <div className="scanline" />

      {/* Sidebar izquierdo */}
      <Sidebar workspaces={workspaces} />

      {/* Área principal */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* QuickCapture — client overlay con Ctrl+K */}
        <div className="flex-shrink-0 flex items-center justify-end px-4 pt-3 pb-2 border-b border-jarvis-cyan/10">
          <QuickCapture workspaces={workspaces} />
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
          {/* DailyBanner — client overlay */}
          <DailyBanner todayTasks={todayTasks} existingFocus={existingFocus} />

          {children}
        </div>
      </main>
    </div>
  );
}
