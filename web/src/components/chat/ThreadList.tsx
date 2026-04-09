"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createThread } from "@/lib/chat/actions";
import { useTransition } from "react";
import { cn } from "@/lib/cn";
import type { ChatThread } from "@/lib/chat/types";

interface ThreadListProps {
  threads: ChatThread[];
  activeThreadId: string | null;
}

export function ThreadList({ threads, activeThreadId }: ThreadListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleNewThread = () => {
    startTransition(async () => {
      const thread = await createThread();
      const params = new URLSearchParams(searchParams.toString());
      params.set("thread", thread.id);
      router.push(`/chat?${params.toString()}`);
    });
  };

  const handleSelectThread = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("thread", id);
    router.push(`/chat?${params.toString()}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)]">
        <span className="text-xs font-semibold text-[color:var(--text-dim)] uppercase tracking-wide">
          Conversaciones
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleNewThread}
          loading={isPending}
          aria-label="Nueva conversación"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
        </Button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto scroll-minimal py-2">
        {threads.length > 0 ? (
          threads.map((thread) => {
            const isActive = thread.id === activeThreadId;
            let dateLabel = "";
            try {
              dateLabel = formatDistanceToNow(parseISO(thread.updated_at), {
                addSuffix: true,
                locale: es,
              });
            } catch {
              dateLabel = "";
            }

            return (
              <button
                key={thread.id}
                onClick={() => handleSelectThread(thread.id)}
                className={cn(
                  "w-full text-left flex items-start gap-2.5 px-4 py-2.5",
                  "transition-colors duration-150",
                  "focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]",
                  isActive
                    ? "bg-[rgba(94,142,255,0.10)] text-[color:var(--text)]"
                    : "hover:bg-[color:var(--surface-2)] text-[color:var(--text-dim)]"
                )}
                aria-current={isActive ? "page" : undefined}
                aria-label={thread.title ?? "Nuevo chat"}
              >
                <MessageSquare
                  className="w-3.5 h-3.5 mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-xs font-medium truncate">
                    {thread.title ?? "Nuevo chat"}
                  </span>
                  {dateLabel ? (
                    <span className="text-[10px] text-[color:var(--text-mute)]">
                      {dateLabel}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })
        ) : (
          <p className="text-xs text-[color:var(--text-mute)] px-4 py-3">
            Sin conversaciones
          </p>
        )}
      </div>
    </div>
  );
}
