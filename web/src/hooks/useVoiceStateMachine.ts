"use client";

import { useReducer } from "react";

// --- State types ---

export type VoiceState = "idle" | "listening" | "processing" | "speaking";

export type VoiceAction =
  | { type: "START_LISTENING" }
  | { type: "STOP_LISTENING" }
  | { type: "CANCEL" }
  | { type: "START_PROCESSING" }
  | { type: "START_SPEAKING" }
  | { type: "STOP_SPEAKING" }
  | { type: "BARGE_IN" }
  | { type: "ERROR"; payload: string };

export interface VoiceStateMachineState {
  state: VoiceState;
  error: string | null;
  transcript: string;
}

// --- Transition table ---

const TRANSITIONS: Record<VoiceState, Partial<Record<VoiceAction["type"], VoiceState>>> = {
  idle: {
    START_LISTENING: "listening",
  },
  listening: {
    STOP_LISTENING: "processing",
    CANCEL: "idle",
    ERROR: "idle",
  },
  processing: {
    START_SPEAKING: "speaking",
    CANCEL: "idle",
    ERROR: "idle",
  },
  speaking: {
    STOP_SPEAKING: "idle",
    BARGE_IN: "listening",
    CANCEL: "idle",
    ERROR: "idle",
  },
};

// --- Reducer ---

function voiceReducer(
  state: VoiceStateMachineState,
  action: VoiceAction
): VoiceStateMachineState {
  const allowedTransitions = TRANSITIONS[state.state];
  const nextState = allowedTransitions[action.type];

  if (!nextState) {
    // Silently ignore invalid transitions
    return state;
  }

  if (action.type === "ERROR") {
    return {
      state: nextState,
      error: action.payload,
      transcript: state.transcript,
    };
  }

  if (action.type === "STOP_LISTENING" || action.type === "CANCEL" || action.type === "BARGE_IN") {
    return {
      state: nextState,
      error: null,
      transcript: state.transcript,
    };
  }

  return {
    state: nextState,
    error: null,
    transcript: state.transcript,
  };
}

const INITIAL_STATE: VoiceStateMachineState = {
  state: "idle",
  error: null,
  transcript: "",
};

// --- Hook ---

export interface UseVoiceStateMachineReturn {
  machineState: VoiceStateMachineState;
  dispatch: React.Dispatch<VoiceAction>;
  isIdle: boolean;
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
}

export function useVoiceStateMachine(): UseVoiceStateMachineReturn {
  const [machineState, dispatch] = useReducer(voiceReducer, INITIAL_STATE);

  return {
    machineState,
    dispatch,
    isIdle: machineState.state === "idle",
    isListening: machineState.state === "listening",
    isProcessing: machineState.state === "processing",
    isSpeaking: machineState.state === "speaking",
  };
}
