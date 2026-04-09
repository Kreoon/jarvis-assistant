"use client";

import { useCallback, useEffect, useState } from "react";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { apiClient } from "@/lib/api";

export type VoiceState = "idle" | "listening" | "processing" | "speaking";

export interface VoiceMessage {
  role: "user" | "assistant";
  content: string;
}

export interface UseVoiceSessionReturn {
  state: VoiceState;
  transcript: string;
  interim: string;
  messages: VoiceMessage[];
  error: string | null;
  isSupported: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

/**
 * Minimal voice session: listens with Web Speech API, sends final transcript
 * to Jarvis chat endpoint, speaks back with browser TTS (SpeechSynthesis).
 * Fallbacks gracefully if any API is unavailable.
 */
export function useVoiceSession(): UseVoiceSessionReturn {
  const [state, setState] = useState<VoiceState>("idle");
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFinalTranscript = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setState("processing");

    try {
      const res = await apiClient.chat(text);
      const reply = res.response ?? "";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);

      // Browser TTS fallback (works offline, no API key)
      if (typeof window !== "undefined" && "speechSynthesis" in window && reply) {
        setState("speaking");
        const utter = new SpeechSynthesisUtterance(reply);
        utter.lang = "es-CO";
        utter.rate = 1.1;
        utter.onend = () => setState("idle");
        utter.onerror = () => setState("idle");
        window.speechSynthesis.speak(utter);
      } else {
        setState("idle");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setState("idle");
    }
  }, []);

  const speech = useSpeechRecognition(handleFinalTranscript);

  // Reflect listening state
  useEffect(() => {
    if (speech.isListening) setState("listening");
    else if (state === "listening") setState("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.isListening]);

  // Surface speech errors
  useEffect(() => {
    if (speech.error) setError(speech.error);
  }, [speech.error]);

  const start = useCallback(() => {
    setError(null);
    speech.start();
  }, [speech]);

  const stop = useCallback(() => {
    speech.stop();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setState("idle");
  }, [speech]);

  const reset = useCallback(() => {
    stop();
    setMessages([]);
    setError(null);
  }, [stop]);

  return {
    state,
    transcript: speech.transcript,
    interim: speech.interimTranscript,
    messages,
    error,
    isSupported: speech.isSupported,
    start,
    stop,
    reset,
  };
}
