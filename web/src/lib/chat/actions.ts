"use server";

import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ChatThread, ChatMessage, ChatRole } from "./types";

// ─── Threads ──────────────────────────────────────────────────────────────────

export async function listThreads(): Promise<ChatThread[]> {
  const { data, error } = await supabaseAdmin
    .from("chat_threads")
    .select("*")
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`listThreads: ${error.message}`);
  return (data ?? []) as ChatThread[];
}

export async function createThread(title?: string): Promise<ChatThread> {
  const { data, error } = await supabaseAdmin
    .from("chat_threads")
    .insert({ title: title ?? null })
    .select()
    .single();

  if (error) throw new Error(`createThread: ${error.message}`);
  revalidatePath("/chat");
  return data as ChatThread;
}

export async function getThread(
  id: string
): Promise<{ thread: ChatThread; messages: ChatMessage[] } | null> {
  const { data: thread, error: threadError } = await supabaseAdmin
    .from("chat_threads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (threadError) throw new Error(`getThread: ${threadError.message}`);
  if (!thread) return null;

  const { data: messages, error: msgError } = await supabaseAdmin
    .from("chat_messages")
    .select("*")
    .eq("thread_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (msgError) throw new Error(`getThread messages: ${msgError.message}`);

  return {
    thread: thread as ChatThread,
    messages: (messages ?? []) as ChatMessage[],
  };
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function appendMessage(
  threadId: string,
  role: ChatRole,
  content: string,
  agent?: string
): Promise<ChatMessage> {
  const { data, error } = await supabaseAdmin
    .from("chat_messages")
    .insert({
      thread_id: threadId,
      role,
      content,
      agent: agent ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`appendMessage: ${error.message}`);

  // Actualizar updated_at del thread
  await supabaseAdmin
    .from("chat_threads")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", threadId);

  revalidatePath("/chat");
  return data as ChatMessage;
}

export async function archiveThread(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("chat_threads")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(`archiveThread: ${error.message}`);
  revalidatePath("/chat");
}
