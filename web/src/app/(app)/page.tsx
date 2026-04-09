import { getTodayTasks } from "@/lib/tasks/actions";
import { apiClient } from "@/lib/api";
import { Greeting } from "@/components/today/Greeting";
import { TopTasks } from "@/components/today/TopTasks";
import { UpcomingEvents } from "@/components/today/UpcomingEvents";
import { FocusCTA } from "@/components/today/FocusCTA";
import { QuickAsk } from "@/components/today/QuickAsk";

async function safeEvents() {
  try {
    return await apiClient.getCalendarEvents(2);
  } catch {
    return [];
  }
}

export default async function TodayPage() {
  const [topTasks, events] = await Promise.all([getTodayTasks(), safeEvents()]);

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-10 md:py-14 space-y-10">
      <Greeting />

      <section>
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-mute)] font-semibold mb-2">
          Hoy
        </h2>
        <TopTasks tasks={topTasks} />
      </section>

      {events.length > 0 && (
        <section>
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--text-mute)] font-semibold mb-2">
            Agenda
          </h2>
          <UpcomingEvents events={events} />
        </section>
      )}

      <FocusCTA topTask={topTasks[0]} />

      <QuickAsk />
    </div>
  );
}
