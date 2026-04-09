import { cn } from "@/lib/cn";

export interface TimelineEvent {
  id: string;
  source: "calendar" | "task";
  title: string;
  start: string; // ISO string
  end?: string;
  color?: string;
  taskId?: string;
  eventLink?: string;
}

interface EventCardProps {
  event: TimelineEvent;
  onTaskClick?: (taskId: string) => void;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("es-CO", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

export function EventCard({ event, onTaskClick }: EventCardProps) {
  const dotColor =
    event.source === "calendar" ? "var(--accent)" : "var(--warning)";

  const handleClick = () => {
    if (event.source === "task" && event.taskId && onTaskClick) {
      onTaskClick(event.taskId);
    } else if (event.source === "calendar" && event.eventLink) {
      window.open(event.eventLink, "_blank", "noopener,noreferrer");
    }
  };

  const isInteractive =
    (event.source === "task" && !!event.taskId) ||
    (event.source === "calendar" && !!event.eventLink);

  return (
    <button
      onClick={isInteractive ? handleClick : undefined}
      disabled={!isInteractive}
      className={cn(
        "w-full text-left flex items-start gap-2 py-1.5 px-2 rounded-[var(--radius-sm)]",
        "transition-colors duration-150",
        isInteractive
          ? "hover:bg-[color:var(--surface-2)] cursor-pointer"
          : "cursor-default",
        "focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]"
      )}
      aria-label={`${event.title}${isInteractive ? " — haz clic para ver detalle" : ""}`}
    >
      <span
        className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: dotColor }}
        aria-hidden="true"
      />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[11px] text-[color:var(--text-mute)]">
          {formatTime(event.start)}
          {event.end ? ` – ${formatTime(event.end)}` : ""}
        </span>
        <span className="text-xs text-[color:var(--text)] leading-snug truncate">
          {event.title}
        </span>
      </div>
    </button>
  );
}
