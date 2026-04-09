import { Badge } from "@/components/ui/Badge";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/cn";

export interface Memory {
  id: string;
  content: string;
  namespace: string;
  created_at: string;
  metadata?: unknown;
}

interface NoteCardProps {
  memory: Memory;
  onClick: (memory: Memory) => void;
}

function extractTitle(content: string): string {
  const first = content.split("\n")[0] ?? "";
  return first.replace(/^#+\s*/, "").trim() || "Sin título";
}

function extractSnippet(content: string): string {
  const lines = content.split("\n").filter((l) => l.trim());
  return lines.slice(1, 4).join(" ").trim();
}

export function NoteCard({ memory, onClick }: NoteCardProps) {
  const title = extractTitle(memory.content);
  const snippet = extractSnippet(memory.content);

  let dateLabel = "";
  try {
    dateLabel = formatDistanceToNow(parseISO(memory.created_at), {
      addSuffix: true,
      locale: es,
    });
  } catch {
    dateLabel = "";
  }

  return (
    <button
      onClick={() => onClick(memory)}
      className={cn(
        "w-full text-left flex flex-col gap-2 p-4 rounded-[var(--radius-lg)]",
        "bg-[color:var(--surface-solid)] border border-[color:var(--border)]",
        "hover:border-[color:var(--border-strong)] transition-all duration-200",
        "hover:shadow-[0_2px_12px_rgba(0,0,0,0.25)]",
        "focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]"
      )}
      aria-label={`Nota: ${title}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-[color:var(--text)] leading-snug line-clamp-1 flex-1 min-w-0">
          {title}
        </h3>
        <Badge variant="accent" className="shrink-0">
          {memory.namespace}
        </Badge>
      </div>

      {snippet ? (
        <p className="text-xs text-[color:var(--text-dim)] leading-relaxed line-clamp-3">
          {snippet}
        </p>
      ) : null}

      {dateLabel ? (
        <span className="text-[11px] text-[color:var(--text-mute)]">
          {dateLabel}
        </span>
      ) : null}
    </button>
  );
}
