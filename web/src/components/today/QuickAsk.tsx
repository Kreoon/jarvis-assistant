"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";

export function QuickAsk() {
  const [value, setValue] = useState("");
  const router = useRouter();

  const submit = () => {
    const q = value.trim();
    if (!q) return;
    router.push(`/chat?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="flex items-end gap-2 p-3 rounded-[var(--radius-lg)] bg-[color:var(--surface-solid)] border border-[color:var(--border)] focus-within:border-[color:var(--accent)]/50 transition-colors">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
        placeholder="Pregúntale a Jarvis…"
        className="flex-1 bg-transparent text-[15px] text-[color:var(--text)] placeholder:text-[color:var(--text-mute)] resize-none outline-none"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!value.trim()}
        className="flex items-center justify-center w-9 h-9 rounded-full bg-[color:var(--accent)] text-white disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
        aria-label="Enviar"
      >
        <ArrowUp className="w-4 h-4" />
      </button>
    </div>
  );
}
