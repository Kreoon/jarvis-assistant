"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  parseISO,
  isSameDay,
  isSameMonth,
  format,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { TimelineEvent } from "./EventCard";
import { cn } from "@/lib/cn";

interface MonthViewProps {
  events: TimelineEvent[];
  currentDate: Date;
}

const DAY_HEADERS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function MonthView({ events, currentDate }: MonthViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const today = new Date();

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate =
      direction === "prev"
        ? subMonths(currentDate, 1)
        : addMonths(currentDate, 1);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "month");
    params.set("date", format(newDate, "yyyy-MM-dd"));
    router.push(`/agenda?${params.toString()}`);
  };

  const handleDayClick = (day: Date) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "week");
    params.set("date", format(day, "yyyy-MM-dd"));
    router.push(`/agenda?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Navegación */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateMonth("prev")}
          aria-label="Mes anterior"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </Button>
        <span className="text-sm font-medium text-[color:var(--text)] min-w-[160px] text-center capitalize">
          {format(currentDate, "MMMM yyyy", { locale: es })}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateMonth("next")}
          aria-label="Mes siguiente"
        >
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>

      {/* Grid cabeceras */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_HEADERS.map((h) => (
          <div
            key={h}
            className="text-center text-[10px] font-semibold text-[color:var(--text-mute)] uppercase tracking-wide py-1"
          >
            {h}
          </div>
        ))}
      </div>

      {/* Grid días */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isToday = isSameDay(day, today);
          const inCurrentMonth = isSameMonth(day, currentDate);

          const dayEvents = events.filter((e) => {
            try {
              return isSameDay(parseISO(e.start), day);
            } catch {
              return false;
            }
          });
          const visibleEvents = dayEvents.slice(0, 3);
          const extra = dayEvents.length - visibleEvents.length;

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDayClick(day)}
              className={cn(
                "flex flex-col gap-0.5 rounded-[var(--radius-sm)] p-1.5 min-h-[72px] text-left",
                "transition-colors duration-150 border",
                "hover:bg-[color:var(--surface-2)]",
                "focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]",
                isToday
                  ? "border-[color:var(--accent)] bg-[rgba(94,142,255,0.06)]"
                  : "border-[color:var(--border)]",
                !inCurrentMonth && "opacity-40"
              )}
              aria-label={`${format(day, "d MMMM yyyy", { locale: es })}${dayEvents.length > 0 ? `, ${dayEvents.length} evento${dayEvents.length !== 1 ? "s" : ""}` : ""}`}
            >
              <span
                className={cn(
                  "text-xs font-semibold leading-none",
                  isToday
                    ? "text-[color:var(--accent)]"
                    : "text-[color:var(--text-dim)]"
                )}
              >
                {format(day, "d")}
              </span>
              <div className="flex flex-col gap-0.5 mt-0.5">
                {visibleEvents.map((event) => (
                  <span
                    key={event.id}
                    className="text-[9px] leading-tight truncate rounded px-1 py-0.5"
                    style={{
                      backgroundColor:
                        event.source === "calendar"
                          ? "rgba(94,142,255,0.18)"
                          : "rgba(255,159,10,0.18)",
                      color:
                        event.source === "calendar"
                          ? "var(--accent)"
                          : "var(--warning)",
                    }}
                  >
                    {event.title}
                  </span>
                ))}
                {extra > 0 ? (
                  <span className="text-[9px] text-[color:var(--text-mute)]">
                    +{extra} más
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
