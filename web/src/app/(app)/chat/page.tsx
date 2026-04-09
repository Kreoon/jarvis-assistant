import { Suspense } from "react";
import { listThreads, createThread, getThread } from "@/lib/chat/actions";
import { ChatPageClient } from "./ChatPageClient";
import type { ChatThread } from "@/lib/chat/types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ thread?: string; q?: string }>;
}

export default async function ChatPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Obtener lista de threads
  const threads: ChatThread[] = await listThreads().catch(
    (): ChatThread[] => []
  );

  // Resolver thread activo
  let activeThreadId = params.thread ?? threads[0]?.id ?? null;

  // Si no hay ningún thread, crear uno nuevo
  if (!activeThreadId) {
    try {
      const newThread = await createThread();
      activeThreadId = newThread.id;
      threads.unshift(newThread);
    } catch {
      // Sin base de datos todavía — continúa con estado vacío
    }
  }

  // Obtener mensajes del thread activo
  const threadData = activeThreadId
    ? await getThread(activeThreadId).catch(() => null)
    : null;

  return (
    <Suspense>
      <ChatPageClient
        threads={threads}
        activeThreadId={activeThreadId}
        initialMessages={threadData?.messages ?? []}
        initialQuery={params.q}
      />
    </Suspense>
  );
}
