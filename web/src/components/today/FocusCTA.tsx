import Link from "next/link";
import { Target } from "lucide-react";
import type { Task } from "@/lib/tasks/types";

export function FocusCTA({ topTask }: { topTask?: Task }) {
  const href = topTask ? `/focus?task=${topTask.id}` : "/focus";
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-4 px-5 py-4 rounded-[var(--radius-lg)] bg-[color:var(--surface-solid)] border border-[color:var(--border)] hover:border-[color:var(--accent)]/40 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[color:var(--accent)]/15 text-[color:var(--accent)] flex items-center justify-center">
          <Target className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-[color:var(--text)]">
            Empezar foco
          </p>
          <p className="text-xs text-[color:var(--text-dim)]">
            {topTask ? topTask.title : "Una sesión de 25 minutos"}
          </p>
        </div>
      </div>
      <span className="text-[color:var(--text-mute)] group-hover:text-[color:var(--accent)] transition-colors">
        →
      </span>
    </Link>
  );
}
