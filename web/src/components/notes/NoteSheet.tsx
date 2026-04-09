"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sheet } from "@/components/ui/Sheet";
import { Badge } from "@/components/ui/Badge";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { Memory } from "./NoteCard";

interface NoteSheetProps {
  memory: Memory | null;
  onClose: () => void;
}

export function NoteSheet({ memory, onClose }: NoteSheetProps) {
  let dateLabel = "";
  if (memory) {
    try {
      dateLabel = formatDistanceToNow(parseISO(memory.created_at), {
        addSuffix: true,
        locale: es,
      });
    } catch {
      dateLabel = "";
    }
  }

  return (
    <Sheet
      open={!!memory}
      onClose={onClose}
      title="Nota"
      side="right"
    >
      {memory ? (
        <div className="flex flex-col gap-4">
          {/* Meta */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="accent">{memory.namespace}</Badge>
            {dateLabel ? (
              <span className="text-[11px] text-[color:var(--text-mute)]">
                {dateLabel}
              </span>
            ) : null}
          </div>

          {/* Contenido markdown */}
          <article
            className="prose prose-invert prose-sm max-w-none"
            style={
              {
                "--tw-prose-body": "var(--text-dim)",
                "--tw-prose-headings": "var(--text)",
                "--tw-prose-links": "var(--accent)",
                "--tw-prose-code": "var(--text)",
                "--tw-prose-pre-bg": "var(--surface-solid)",
                "--tw-prose-hr": "var(--border)",
                "--tw-prose-bullets": "var(--text-mute)",
              } as React.CSSProperties
            }
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {memory.content}
            </ReactMarkdown>
          </article>
        </div>
      ) : null}
    </Sheet>
  );
}
