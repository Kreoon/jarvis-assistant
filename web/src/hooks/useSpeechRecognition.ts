"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API type declarations (not in all TS libs)
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export interface UseSpeechRecognitionReturn {
  start: () => void;
  stop: () => void;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  isListening: boolean;
  error: string | null;
}

export function useSpeechRecognition(
  onFinalTranscript?: (text: string) => void
): UseSpeechRecognitionReturn {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const SpeechRecognitionClass =
    typeof window !== "undefined"
      ? window.SpeechRecognition ?? window.webkitSpeechRecognition
      : null;

  const isSupported = SpeechRecognitionClass !== null && SpeechRecognitionClass !== undefined;

  const start = useCallback(() => {
    if (!isSupported || !SpeechRecognitionClass) {
      setError("Speech recognition not supported in this browser.");
      return;
    }

    // Clean up previous instance
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = "es-CO";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      setTranscript("");
      setInterimTranscript("");
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        setTranscript((prev) => prev + final);
        setInterimTranscript("");
        onFinalTranscript?.(final.trim());
      } else {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: any) => {
      const errorMessages: Record<string, string> = {
        "no-speech": "No se detectó audio. Intenta de nuevo.",
        "audio-capture": "No se pudo acceder al micrófono.",
        "not-allowed": "Permiso de micrófono denegado.",
        network: "Error de red durante el reconocimiento.",
        aborted: "Reconocimiento cancelado.",
      };
      setError(errorMessages[event.error] ?? `Error: ${event.error}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, SpeechRecognitionClass, onFinalTranscript]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  return {
    start,
    stop,
    transcript,
    interimTranscript,
    isSupported,
    isListening,
    error,
  };
}
