"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  parseISO,
  isSameDay,
  format,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EventCard } from "./EventCard";
import type { TimelineEvent } from "./EventCard";
import { cn } from "@/lib/cn";

interface WeekViewProps {
  events: TimelineEvent[];
  currentDate: Date;
}

export function WeekView({ events, currentDate }: WeekViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // lunes
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const navigateWeek = (direction: "prev" | "next") => {
    const newDate =
      direction === "prev"
        ? subWeeks(currentDate, 1)
        : addWeeks(currentDate, 1);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "week");
    params.set("date", format(newDate, "yyyy-MM-dd"));
    router.push(`/agenda?${params.toString()}`);
  };

  const today = new Date();

  return (
    <div className="flex flex-col gap-4">
      {/* Navegación */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateWeek("prev")}
          aria-label="Semana anterior"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </Button>
        <span className="text-sm font-medium text-[color:var(--text)] min-w-[200px] text-center">
          {format(weekStart, "d MMM", { locale: es })} –{" "}
          {format(addDays(weekStart, 6), "d MMM yyyy", { locale: es })}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateWeek("next")}
          aria-label="Semana siguiente"
        >
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Grid semana — scroll horizontal en móvil */}
      <div className="overflow-x-auto -mx-6 px-6">
        <div
          className="grid min-w-[560px] gap-2"
          style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
        >
          {days.map((day) => {
            const isToday = isSameDay(day, today);
            const dayEvents = events
              .filter((e) => {
                try {
                  return isSameDay(parseISO(e.start), day);
                } catch {
                  return false;
                }
              })
              .sort(
                (a, b) =>
                  new Date(a.start).getTime() - new Date(b.start).getTime()
              );

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "flex flex-col gap-1 rounded-[var(--radius-md)] p-2 min-h-[120px]",
                  "bg-[color:var(--surface-solid)] border",
                  isToday
                    ? "border-[color:var(--accent)]"
                    : "border-[color:var(--border)]"
                )}
              >
                {/* Header día */}
                <div className="flex items-center gap-1.5 pb-1 border-b border-[color:var(--border)]">
                  <span
                    className={cn(
                      "text-[11px] font-medium uppercase tracking-wide",
                      isToday
                        ? "text-[color:var(--accent)]"
                        : "text-[color:var(--text-dim)]"
                    )}
                  >
                    {format(day, "EEE", { locale: es })}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      isToday
                        ? "text-[color:var(--accent)]"
                        : "text-[color:var(--text)]"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>

                {/* Eventos */}
                <div className="flex flex-col gap-0.5">
                  {dayEvents.length > 0 ? (
                    dayEvents.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))
                  ) : (
                    <span className="text-[10px] text-[color:var(--text-mute)] py-1 px-2">
                      Sin eventos
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
