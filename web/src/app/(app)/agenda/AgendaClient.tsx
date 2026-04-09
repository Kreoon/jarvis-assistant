"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { parseISO } from "date-fns";
import { Button } from "@/components/ui/Button";
import { WeekView } from "@/components/agenda/WeekView";
import { MonthView } from "@/components/agenda/MonthView";
import type { TimelineEvent } from "@/components/agenda/EventCard";

interface AgendaClientProps {
  events: TimelineEvent[];
  view: "week" | "month";
  dateStr: string;
}

export function AgendaClient({ events, view, dateStr }: AgendaClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  let currentDate: Date;
  try {
    currentDate = parseISO(dateStr);
    if (isNaN(currentDate.getTime())) throw new Error("invalid");
  } catch {
    currentDate = new Date();
  }

  const switchView = (v: "week" | "month") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", v);
    router.push(`/agenda?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[color:var(--text)]">
          Agenda
        </h1>
        <div
          className="flex items-center gap-1 p-1 rounded-[var(--radius-md)] bg-[color:var(--surface-solid)] border border-[color:var(--border)]"
          role="group"
          aria-label="Cambiar vista de agenda"
        >
          <Button
            variant={view === "week" ? "primary" : "ghost"}
            size="sm"
            onClick={() => switchView("week")}
            aria-pressed={view === "week"}
          >
            Semana
          </Button>
          <Button
            variant={view === "month" ? "primary" : "ghost"}
            size="sm"
            onClick={() => switchView("month")}
            aria-pressed={view === "month"}
          >
            Mes
          </Button>
        </div>
      </div>

      {/* Vista */}
      {view === "week" ? (
        <WeekView events={events} currentDate={currentDate} />
      ) : (
        <MonthView events={events} currentDate={currentDate} />
      )}
    </div>
  );
}
