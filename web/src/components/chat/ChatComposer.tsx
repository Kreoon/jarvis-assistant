"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { SendHorizonal, Paperclip } from "lucide-react";
import { appendMessage } from "@/lib/chat/actions";
import { JarvisAPI } from "@/lib/api";
import { cn } from "@/lib/cn";

const apiClient = new JarvisAPI(
  process.env.NEXT_PUBLIC_API_TOKEN ?? "",
  process.env.NEXT_PUBLIC_API_URL
);

interface ChatComposerProps {
  threadId: string;
  initialQuery?: string;
}

export function ChatComposer({ threadId, initialQuery }: ChatComposerProps) {
  const [text, setText] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoSentRef = useRef(false);

  // Auto-resize del textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  // Auto-populate y auto-envío si viene initialQuery
  useEffect(() => {
    if (initialQuery && !autoSentRef.current) {
      autoSentRef.current = true;
      setText(initialQuery);
      // Pequeño delay para que el estado se aplique antes del envío
      const t = setTimeout(() => {
        void handleSend(initialQuery);
      }, 100);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const handleSend = async (overrideText?: string) => {
    const message = (overrideText ?? text).trim();
    if (!message || streaming || isPending) return;

    setText("");
    setStreaming(true);

    try {
      // 1. Guardar mensaje del usuario
      await appendMessage(threadId, "user", message);

      // 2. Stream de respuesta
      let fullText = "";
      let detectedAgent: string | undefined;

      await new Promise<void>((resolve, reject) => {
        abortRef.current = apiClient.chatStream(
          message,
          (chunk) => {
            fullText = chunk;
          },
          (complete) => {
            fullText = complete;
            resolve();
          }
        );

        // Timeout de seguridad 60s
        const timeout = setTimeout(() => {
          abortRef.current?.abort();
          reject(new Error("timeout"));
        }, 60000);

        // Limpiar timeout si resuelve antes
        const origResolve = resolve;
        resolve = () => {
          clearTimeout(timeout);
          origResolve();
        };
      });

      // 3. Guardar respuesta del asistente
      if (fullText) {
        startTransition(async () => {
          await appendMessage(threadId, "assistant", fullText, detectedAgent);
        });
      }
    } catch {
      // Silencioso — el usuario puede reintentar
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const isDisabled = streaming || isPending;

  return (
    <div className="border-t border-[color:var(--border)] px-4 py-3">
      <div
        className={cn(
          "flex items-end gap-2 rounded-[var(--radius-lg)]",
          "bg-[color:var(--surface-solid)] border border-[color:var(--border)]",
          "focus-within:border-[color:var(--accent)] transition-colors duration-200",
          "px-3 py-2"
        )}
      >
        {/* Textarea auto-resize */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Mensaje a Jarvis..."
          disabled={isDisabled}
          rows={1}
          className={cn(
            "flex-1 resize-none bg-transparent text-sm text-[color:var(--text)]",
            "placeholder:text-[color:var(--text-mute)]",
            "focus:outline-none scroll-minimal",
            "max-h-40 min-h-[20px]",
            "disabled:opacity-50"
          )}
          aria-label="Escribe un mensaje"
          aria-multiline="true"
        />

        {/* Adjuntar (placeholder) */}
        <button
          type="button"
          disabled
          aria-label="Adjuntar archivo (próximamente)"
          title="Próximamente"
          className="text-[color:var(--text-mute)] opacity-40 cursor-not-allowed p-1"
        >
          <Paperclip className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Enviar */}
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={isDisabled || !text.trim()}
          aria-label="Enviar mensaje"
          className={cn(
            "p-1.5 rounded-[var(--radius-sm)] transition-all duration-200",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "text-[color:var(--accent)] hover:bg-[rgba(94,142,255,0.15)] active:scale-95"
          )}
        >
          {streaming ? (
            <span
              className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin block"
              aria-hidden="true"
            />
          ) : (
            <SendHorizonal className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>
      <p className="text-[10px] text-[color:var(--text-mute)] mt-1.5 px-1">
        Enter para enviar · Shift+Enter para nueva línea
      </p>
    </div>
  );
}
