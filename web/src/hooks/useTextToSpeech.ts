"use client";

import { useCallback, useRef, useState } from "react";
import { getAudioContextManager, type AudioContextManager } from "@/lib/audioContext";

export interface UseTextToSpeechReturn {
  speak: (text: string) => Promise<void>;
  stop: () => void;
  isSpeaking: boolean;
  analyserNode: AnalyserNode | null;
  error: string | null;
}

const DEFAULT_API_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : "http://localhost:3000";

export function useTextToSpeech(token: string, apiUrl?: string): UseTextToSpeechReturn {
  const resolvedApiUrl =
    apiUrl ??
    (typeof process !== "undefined"
      ? (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL)
      : DEFAULT_API_URL);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const managerRef = useRef<AudioContextManager | null>(null);

  const stop = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {
        // Already stopped
      }
      sourceNodeRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string): Promise<void> => {
      // Stop any ongoing playback
      stop();
      setError(null);

      try {
        // Initialize AudioContext on this user gesture
        const manager = getAudioContextManager();
        managerRef.current = manager;

        // Resume if suspended
        if (manager.context.state === "suspended") {
          await manager.context.resume();
        }

        // Fetch audio from backend proxy
        const res = await fetch(`${resolvedApiUrl}/api/tts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) {
          throw new Error(`TTS request failed: ${res.status} ${res.statusText}`);
        }

        const arrayBuffer = await res.arrayBuffer();
        const audioBuffer = await manager.context.decodeAudioData(arrayBuffer);

        const source = manager.context.createBufferSource();
        source.buffer = audioBuffer;

        // Route through TTS analyser for visualization, then to destination
        source.connect(manager.ttsAnalyser);
        sourceNodeRef.current = source;

        setIsSpeaking(true);

        source.onended = () => {
          sourceNodeRef.current = null;
          setIsSpeaking(false);
        };

        source.start(0);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "TTS playback failed";
        setError(message);
        setIsSpeaking(false);
        console.error("[useTextToSpeech]", err);
      }
    },
    [token, resolvedApiUrl, stop]
  );

  const analyserNode = managerRef.current?.ttsAnalyser ?? null;

  return {
    speak,
    stop,
    isSpeaking,
    analyserNode,
    error,
  };
}
