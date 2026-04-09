"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { ThreadList } from "@/components/chat/ThreadList";
import { ChatThread } from "@/components/chat/ChatThread";
import { ChatComposer } from "@/components/chat/ChatComposer";
import type { ChatThread as ChatThreadType, ChatMessage } from "@/lib/chat/types";

interface ChatPageClientProps {
  threads: ChatThreadType[];
  activeThreadId: string | null;
  initialMessages: ChatMessage[];
  initialQuery?: string;
}

export function ChatPageClient({
  threads,
  activeThreadId,
  initialMessages,
  initialQuery,
}: ChatPageClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-[calc(100dvh-var(--shell-header-h,56px))] overflow-hidden">
      {/* Sidebar desktop */}
      <aside
        className="hidden md:flex w-64 flex-col border-r border-[color:var(--border)] bg-[color:var(--surface-solid)] shrink-0"
        aria-label="Lista de conversaciones"
      >
        <ThreadList threads={threads} activeThreadId={activeThreadId} />
      </aside>

      {/* Sidebar móvil como Sheet */}
      <Sheet
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        title="Conversaciones"
        side="right"
      >
        <ThreadList threads={threads} activeThreadId={activeThreadId} />
      </Sheet>

      {/* Panel principal */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Sub-header móvil */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border)] md:hidden">
          <span className="text-sm font-semibold text-[color:var(--text)]">
            Chat
          </span>
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Ver conversaciones"
            className="text-[color:var(--text-dim)] hover:text-[color:var(--text)] transition-colors"
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Mensajes */}
        {activeThreadId ? (
          <>
            <ChatThread
              messages={initialMessages}
              threadId={activeThreadId}
            />
            <ChatComposer
              threadId={activeThreadId}
              initialQuery={initialQuery}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-[color:var(--text-mute)]">
              Selecciona o crea una conversación.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
