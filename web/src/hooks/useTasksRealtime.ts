"use client";

import { useEffect, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Task } from "@/lib/tasks/types";

type ChangeEvent = RealtimePostgresChangesPayload<Task>;

interface UseTasksRealtimeOptions {
  onChange: (event: ChangeEvent) => void;
  workspaceId?: string;
}

export function useTasksRealtime({
  onChange,
  workspaceId,
}: UseTasksRealtimeOptions): void {
  const stableOnChange = useCallback(onChange, [onChange]);

  useEffect(() => {
    const channelName = workspaceId
      ? `tasks:workspace:${workspaceId}`
      : "tasks:all";

    const filter = workspaceId
      ? `workspace_id=eq.${workspaceId}`
      : undefined;

    const channel = supabaseBrowser
      .channel(channelName)
      .on<Task>(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          stableOnChange(payload);
        }
      )
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [stableOnChange, workspaceId]);
}
