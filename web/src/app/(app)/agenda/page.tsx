import { Suspense } from "react";
import { AgendaClient } from "./AgendaClient";
import { getTasks } from "@/lib/tasks/actions";
import type { CalendarEvent } from "@/lib/api";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ view?: string; date?: string }>;
}

async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  try {
    // El apiClient requiere token y corre en cliente — en server component
    // llamamos directamente al endpoint interno si está disponible,
    // o devolvemos vacío. La vista client hará el fetch si se necesita.
    return [];
  } catch {
    return [];
  }
}

export default async function AgendaPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const view = params.view === "month" ? "month" : "week";
  const dateStr = params.date ?? new Date().toISOString().split("T")[0];

  const [tasks, calendarEvents] = await Promise.all([
    getTasks({ includeDone: false }).catch(() => []),
    fetchCalendarEvents(),
  ]);

  // Filtrar tasks con due_date para la agenda
  const taskEvents = tasks
    .filter((t) => t.due_date !== null)
    .map((t) => ({
      id: `task-${t.id}`,
      source: "task" as const,
      title: t.title,
      start: `${t.due_date}T09:00:00`,
      taskId: t.id,
    }));

  const calEvents = calendarEvents.map((e) => ({
    id: `cal-${e.id}`,
    source: "calendar" as const,
    title: e.summary,
    start: e.start,
    end: e.end,
    eventLink: e.description?.startsWith("http") ? e.description : undefined,
  }));

  const allEvents = [...calEvents, ...taskEvents];

  return (
    <Suspense>
      <AgendaClient
        events={allEvents}
        view={view as "week" | "month"}
        dateStr={dateStr}
      />
    </Suspense>
  );
}
