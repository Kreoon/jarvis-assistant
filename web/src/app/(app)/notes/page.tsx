"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, FileText } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { NoteCard } from "@/components/notes/NoteCard";
import { NoteSheet } from "@/components/notes/NoteSheet";
import { JarvisAPI } from "@/lib/api";
import type { Memory } from "@/components/notes/NoteCard";

const apiClient = new JarvisAPI(
  process.env.NEXT_PUBLIC_API_TOKEN ?? "",
  process.env.NEXT_PUBLIC_API_URL
);

function normalizeMemories(raw: unknown): Memory[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((item, i) => {
      if (typeof item === "object" && item !== null) {
        const r = item as Record<string, unknown>;
        return {
          id: String(r.id ?? i),
          content: String(r.content ?? ""),
          namespace: String(r.namespace ?? "general"),
          created_at: String(r.created_at ?? new Date().toISOString()),
          metadata: r.metadata,
        };
      }
      return {
        id: String(i),
        content: String(item),
        namespace: "general",
        created_at: new Date().toISOString(),
      };
    });
  }
  // Si es objeto con .results
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj.results)) return normalizeMemories(obj.results);
  return [];
}

export default function NotesPage() {
  const [query, setQuery] = useState("");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Memory | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMemories = useCallback(async (q: string) => {
    setLoading(true);
    try {
      if (q.trim()) {
        const result = await apiClient.searchMemory(q.trim());
        setMemories(normalizeMemories(result));
      } else {
        const result = await apiClient.listMemories("general");
        setMemories(normalizeMemories(result));
      }
    } catch {
      setMemories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    void loadMemories("");
  }, [loadMemories]);

  // Debounce en cambio de query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void loadMemories(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, loadMemories]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-[color:var(--text)]">
          Notas
        </h1>
        <div className="relative max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[color:var(--text-mute)]"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en memorias..."
            className="pl-9"
            aria-label="Buscar notas"
          />
        </div>
      </div>

      {/* Resultados */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="text-sm text-[color:var(--text-mute)]">
            Buscando...
          </span>
        </div>
      ) : memories.length > 0 ? (
        <div className="flex flex-col gap-2">
          {memories.map((memory) => (
            <NoteCard
              key={memory.id}
              memory={memory}
              onClick={setSelectedNote}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <FileText
            className="w-10 h-10 text-[color:var(--text-mute)]"
            aria-hidden="true"
          />
          <p className="text-sm text-[color:var(--text-dim)]">
            {query ? `Sin resultados para "${query}".` : "Sin notas. Jarvis las crea al chatear."}
          </p>
        </div>
      )}

      {/* Sheet de detalle */}
      <NoteSheet
        memory={selectedNote}
        onClose={() => setSelectedNote(null)}
      />
    </div>
  );
}
