"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";

interface Command {
  id: string;
  label: string;
  description?: string;
  action: () => void;
}

function useCommands(router: ReturnType<typeof useRouter>): Command[] {
  return [
    {
      id: "new-task",
      label: "Nueva tarea",
      description: "Abrir captura rápida",
      action: () => {
        // Delegar a QuickCapture via evento personalizado
        document.dispatchEvent(new CustomEvent("jarvis:open-quick-capture"));
      },
    },
    {
      id: "go-board",
      label: "Ir al tablero",
      action: () => router.push("/tasks"),
    },
    {
      id: "go-agenda",
      label: "Ir a agenda",
      action: () => router.push("/agenda"),
    },
    {
      id: "go-chat",
      label: "Ir a chat",
      action: () => router.push("/chat"),
    },
    {
      id: "go-projects",
      label: "Ir a proyectos",
      action: () => router.push("/projects"),
    },
    {
      id: "go-notes",
      label: "Ir a notas",
      action: () => router.push("/notes"),
    },
    {
      id: "start-focus",
      label: "Empezar foco",
      description: "Iniciar sesión Pomodoro",
      action: () => router.push("/focus"),
    },
  ];
}

function fuzzyMatch(query: string, label: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const l = label.toLowerCase();
  let qi = 0;
  for (let i = 0; i < l.length && qi < q.length; i++) {
    if (l[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const commands = useCommands(router);

  const filtered = commands.filter((cmd) => fuzzyMatch(query, cmd.label));

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  const execute = useCallback(
    (cmd: Command) => {
      close();
      cmd.action();
    },
    [close]
  );

  // Abrir con Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Navegación con teclado dentro del panel
  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        execute(filtered[selectedIndex]);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, filtered, selectedIndex, close, execute]);

  // Reset selectedIndex cuando cambia el filtro
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus el input al abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Paleta de comandos"
        >
          {/* Overlay */}
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={close}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            className={cn(
              "relative z-10 w-full max-w-lg overflow-hidden",
              "vibrancy rounded-[var(--radius-xl)]",
              "shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
            )}
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[color:var(--border)]">
              <Search
                className="w-4 h-4 text-[color:var(--text-mute)] flex-shrink-0"
                aria-hidden="true"
              />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar comandos..."
                aria-label="Buscar comandos"
                className={cn(
                  "flex-1 bg-transparent text-[color:var(--text)] text-sm",
                  "placeholder:text-[color:var(--text-mute)]",
                  "outline-none border-none"
                )}
              />
              <kbd className="text-[10px] text-[color:var(--text-mute)] px-1.5 py-0.5 rounded bg-[color:var(--surface-2)] border border-[color:var(--border)]">
                ESC
              </kbd>
            </div>

            {/* Lista */}
            <div
              className="max-h-64 overflow-y-auto scroll-minimal py-2"
              role="listbox"
              aria-label="Comandos disponibles"
            >
              {filtered.length === 0 ? (
                <p className="px-4 py-6 text-sm text-center text-[color:var(--text-mute)]">
                  Sin resultados
                </p>
              ) : (
                filtered.map((cmd, i) => (
                  <button
                    key={cmd.id}
                    role="option"
                    aria-selected={i === selectedIndex}
                    onClick={() => execute(cmd)}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={cn(
                      "w-full flex flex-col items-start px-4 py-2.5 text-left",
                      "transition-colors duration-100",
                      i === selectedIndex
                        ? "bg-[color:var(--surface-2)]"
                        : "hover:bg-[color:var(--surface-2)]"
                    )}
                  >
                    <span className="text-sm text-[color:var(--text)]">
                      {cmd.label}
                    </span>
                    {cmd.description ? (
                      <span className="text-xs text-[color:var(--text-mute)]">
                        {cmd.description}
                      </span>
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
