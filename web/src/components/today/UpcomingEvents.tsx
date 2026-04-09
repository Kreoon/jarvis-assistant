interface CalEvent {
  id: string;
  summary?: string;
  start?: string;
  end?: string;
}

export function UpcomingEvents({ events }: { events: CalEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-[color:var(--text-mute)]">
        Sin eventos próximos.
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {events.slice(0, 3).map((e) => {
        const start = e.start ? new Date(e.start) : null;
        return (
          <li
            key={e.id}
            className="flex items-center gap-3 px-3 py-2.5 border-b border-[color:var(--border)] last:border-b-0"
          >
            <span className="text-xs font-medium text-[color:var(--accent)] w-12 shrink-0 tabular-nums">
              {start
                ? start.toLocaleTimeString("es-CO", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })
                : "—"}
            </span>
            <span className="flex-1 text-[15px] text-[color:var(--text)] truncate">
              {e.summary ?? "Sin título"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
