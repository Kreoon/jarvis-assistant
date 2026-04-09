"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cn } from "@/lib/cn";
import type { ChatMessage } from "@/lib/chat/types";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";

interface ChatThreadProps {
  messages: ChatMessage[];
  threadId: string;
}

export function ChatThread({ messages: initialMessages, threadId }: ChatThreadProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Actualizar mensajes cuando cambian los props (navegación entre threads)
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages, threadId]);

  // Scroll al bottom cuando llegan nuevos mensajes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Suscripción Realtime
  useEffect(() => {
    const channel = supabaseBrowser
      .channel(`chat_messages:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload: RealtimePostgresInsertPayload<Record<string, unknown>>) => {
          const newMsg: ChatMessage = {
            id: String(payload.new.id ?? ""),
            thread_id: String(payload.new.thread_id ?? ""),
            role: payload.new.role as ChatMessage["role"],
            content: String(payload.new.content ?? ""),
            agent: payload.new.agent != null ? String(payload.new.agent) : null,
            tool_calls: payload.new.tool_calls ?? null,
            created_at: String(payload.new.created_at ?? new Date().toISOString()),
          };
          setMessages((prev) => {
            // Evitar duplicados
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      void supabaseBrowser.removeChannel(channel);
    };
  }, [threadId]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-[color:var(--text-mute)]">
          Escribe algo para comenzar...
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scroll-minimal px-4 py-4 flex flex-col gap-4">
      {messages.map((msg) => {
        const isUser = msg.role === "user";
        return (
          <div
            key={msg.id}
            className={cn(
              "flex flex-col gap-1 max-w-[80%]",
              isUser ? "self-end items-end" : "self-start items-start"
            )}
          >
            {/* Agente badge */}
            {msg.agent && !isUser ? (
              <span className="text-[10px] text-[color:var(--text-mute)] px-1">
                {msg.agent}
              </span>
            ) : null}

            {/* Burbuja */}
            <div
              className={cn(
                "rounded-[var(--radius-lg)] px-4 py-3 text-sm leading-relaxed",
                isUser
                  ? "bg-[rgba(94,142,255,0.20)] text-[color:var(--text)] rounded-br-sm"
                  : "bg-[color:var(--surface-solid)] border border-[color:var(--border)] text-[color:var(--text)] rounded-bl-sm"
              )}
            >
              {isUser ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <article
                  className="prose prose-invert prose-sm max-w-none"
                  style={
                    {
                      "--tw-prose-body": "var(--text-dim)",
                      "--tw-prose-headings": "var(--text)",
                      "--tw-prose-links": "var(--accent)",
                      "--tw-prose-code": "var(--text)",
                      "--tw-prose-pre-bg": "rgba(0,0,0,0.3)",
                    } as React.CSSProperties
                  }
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </article>
              )}
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}
