"use client";

import React, { createContext, useContext, useMemo } from "react";
import {
  useVoiceStateMachine,
  type VoiceAction,
  type VoiceStateMachineState,
} from "@/hooks/useVoiceStateMachine";
import { JarvisAPI } from "@/lib/api";

// --- Context shape ---

interface VoiceStateContextValue {
  // State machine
  machineState: VoiceStateMachineState;
  dispatch: React.Dispatch<VoiceAction>;

  // Derived booleans for convenience
  isIdle: boolean;
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;

  // Jarvis API instance (token-aware)
  api: JarvisAPI;
}

const VoiceStateContext = createContext<VoiceStateContextValue | null>(null);

// --- Provider ---

interface VoiceStateProviderProps {
  children: React.ReactNode;
  token: string;
  apiUrl?: string;
}

export function VoiceStateProvider({
  children,
  token,
  apiUrl,
}: VoiceStateProviderProps) {
  const { machineState, dispatch, isIdle, isListening, isProcessing, isSpeaking } =
    useVoiceStateMachine();

  // Stable API instance — only recreates if token or apiUrl changes
  const api = useMemo(
    () => new JarvisAPI(token, apiUrl),
    [token, apiUrl]
  );

  const value: VoiceStateContextValue = {
    machineState,
    dispatch,
    isIdle,
    isListening,
    isProcessing,
    isSpeaking,
    api,
  };

  return (
    <VoiceStateContext.Provider value={value}>
      {children}
    </VoiceStateContext.Provider>
  );
}

// --- Consumer hook ---

export function useVoiceState(): VoiceStateContextValue {
  const ctx = useContext(VoiceStateContext);
  if (!ctx) {
    throw new Error("useVoiceState must be used inside <VoiceStateProvider>");
  }
  return ctx;
}
