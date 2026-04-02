"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Trash2, Plus, Mic, MicOff, Loader2 } from "lucide-react";
import { GlassPanel } from "../ui/GlassPanel";
import { MessageBubble } from "./MessageBubble";
import { FileUpload } from "./FileUpload";
import { cn } from "../../lib/cn";
import { JarvisAPI } from "../../lib/api";

// --- Types ---

interface ChatMessage {
  id: string;
  role: "user" | "jarvis";
  text: string;
  timestamp: number;
}

interface ChatPanelProps {
  api: JarvisAPI;
}

// --- Constants ---

const STORAGE_KEY = "jarvis-chat-history";
const MAX_HISTORY = 200;

// --- Helpers ---

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

function saveHistory(messages: ChatMessage[]): void {
  try {
    const trimmed = messages.slice(-MAX_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage quota exceeded or SSR
  }
}

// --- Component ---

export function ChatPanel({ api }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [streamingText, setStreamingText] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Load history on mount
  useEffect(() => {
    setMessages(loadHistory());
  }, []);

  // Persist on change
  useEffect(() => {
    if (messages.length > 0) saveHistory(messages);
  }, [messages]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // Cleanup abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const sendText = useCallback(
    (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        text: text.trim(),
        timestamp: Date.now(),
      };
      appendMessage(userMsg);
      setInput("");
      setIsStreaming(true);
      setStreamingText("");

      abortRef.current?.abort();
      abortRef.current = api.chatStream(
        text.trim(),
        (partial) => {
          setStreamingText(partial);
        },
        (full) => {
          setIsStreaming(false);
          setStreamingText("");
          const jarvisMsg: ChatMessage = {
            id: generateId(),
            role: "jarvis",
            text: full || "Sin respuesta del sistema.",
            timestamp: Date.now(),
          };
          appendMessage(jarvisMsg);
        }
      );
    },
    [api, isStreaming, appendMessage]
  );

  const handleSend = () => sendText(input);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = () => {
    abortRef.current?.abort();
    setMessages([]);
    setStreamingText("");
    setIsStreaming(false);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleFileSelected = async (file: File, caption?: string) => {
    if (isStreaming) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: "user",
      text: caption
        ? `[Archivo: ${file.name}] ${caption}`
        : `[Archivo adjunto: ${file.name}]`,
      timestamp: Date.now(),
    };
    appendMessage(userMsg);
    setIsStreaming(true);
    setStreamingText("Procesando archivo...");

    try {
      const result = await api.uploadAndChat(file, caption);
      const jarvisMsg: ChatMessage = {
        id: generateId(),
        role: "jarvis",
        text: result.response,
        timestamp: Date.now(),
      };
      appendMessage(jarvisMsg);
    } catch {
      appendMessage({
        id: generateId(),
        role: "jarvis",
        text: "ERROR: No se pudo procesar el archivo. Verifica la conexion con el servidor.",
        timestamp: Date.now(),
      });
    } finally {
      setIsStreaming(false);
      setStreamingText("");
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setIsRecording(false);

        appendMessage({
          id: generateId(),
          role: "user",
          text: "[Mensaje de voz]",
          timestamp: Date.now(),
        });
        setIsStreaming(true);
        setStreamingText("Transcribiendo audio...");

        try {
          const result = await api.sendAudio(blob);
          if (result.transcription) {
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              if (last?.role === "user" && last.text === "[Mensaje de voz]") {
                copy[copy.length - 1] = {
                  ...last,
                  text: `[Voz] ${result.transcription}`,
                };
              }
              return copy;
            });
          }
          appendMessage({
            id: generateId(),
            role: "jarvis",
            text: result.response,
            timestamp: Date.now(),
          });
        } catch {
          appendMessage({
            id: generateId(),
            role: "jarvis",
            text: "ERROR: No se pudo transcribir el audio.",
            timestamp: Date.now(),
          });
        } finally {
          setIsStreaming(false);
          setStreamingText("");
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      appendMessage({
        id: generateId(),
        role: "jarvis",
        text: "ERROR: No se pudo acceder al microfono.",
        timestamp: Date.now(),
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="flex flex-col h-full gap-3"
    >
      {/* Header actions */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[9px] text-jarvis-cyan/40 tracking-widest uppercase font-bold">
          COMM_CHANNEL :: SECURE_LINK
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[8px] text-jarvis-cyan/30 font-mono">
            {messages.length} MSG
          </span>
          <button
            onClick={handleNewConversation}
            aria-label="Nueva conversacion"
            className="flex items-center gap-1 text-[9px] text-jarvis-cyan/40 hover:text-jarvis-cyan transition-colors border border-jarvis-cyan/10 hover:border-jarvis-cyan/30 px-2 py-1"
          >
            <Plus className="w-3 h-3" />
            NUEVA
          </button>
          <button
            onClick={handleNewConversation}
            aria-label="Borrar historial"
            className="flex items-center gap-1 text-[9px] text-jarvis-cyan/40 hover:text-red-400 transition-colors border border-jarvis-cyan/10 hover:border-red-400/30 px-2 py-1"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Message list */}
      <GlassPanel className="flex-grow overflow-y-auto custom-scrollbar flex flex-col p-5 gap-5">
        <AnimatePresence initial={false}>
          {messages.length === 0 && !isStreaming && (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-grow flex flex-col items-center justify-center text-center p-8"
            >
              <div className="w-16 h-16 rounded-full border border-jarvis-cyan/20 flex items-center justify-center mb-4 bg-jarvis-cyan/5">
                <Send className="w-6 h-6 text-jarvis-cyan/30" />
              </div>
              <p className="text-[10px] text-jarvis-cyan/30 tracking-widest uppercase">
                Canal de comunicacion listo
              </p>
              <p className="text-[9px] text-jarvis-cyan/20 mt-1">
                Escribe un mensaje o adjunta un archivo
              </p>
            </motion.div>
          )}

          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <MessageBubble
                role={msg.role}
                text={msg.text}
                timestamp={msg.timestamp}
              />
            </motion.div>
          ))}

          {/* Streaming bubble */}
          {isStreaming && (
            <motion.div
              key="streaming"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {streamingText && streamingText !== "Procesando archivo..." && streamingText !== "Transcribiendo audio..." ? (
                <MessageBubble role="jarvis" text={streamingText} />
              ) : (
                <div className="flex flex-col mr-auto items-start max-w-[82%]">
                  <span className="text-[8px] text-jarvis-cyan/50 mb-1 tracking-widest uppercase font-bold">
                    JARVIS_CORE
                  </span>
                  <div className="p-3 bg-black/40 border border-jarvis-cyan/20 text-jarvis-cyan/60 italic text-xs flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {streamingText || "Procesando consulta en nodos neurales..."}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </GlassPanel>

      {/* Input row */}
      <div className="flex gap-2 items-end">
        {/* File upload paperclip */}
        <div className="relative">
          <FileUpload onFileSelected={handleFileSelected} disabled={isStreaming} />
        </div>

        {/* Text input */}
        <input
          className="flex-grow bg-jarvis-glass border border-jarvis-cyan/30 p-3.5 text-jarvis-cyan focus:outline-none focus:border-jarvis-cyan placeholder:text-jarvis-cyan/20 text-sm tracking-widest disabled:opacity-40"
          placeholder="INGRESA COMANDO PARA JARVIS..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          aria-label="Mensaje para Jarvis"
        />

        {/* Mic button */}
        <button
          onClick={handleToggleRecording}
          disabled={isStreaming}
          aria-label={isRecording ? "Detener grabacion" : "Grabar audio"}
          className={cn(
            "p-3.5 border transition-all duration-300",
            isRecording
              ? "text-red-400 border-red-400/50 bg-red-400/10 animate-pulse"
              : "text-jarvis-cyan/40 border-jarvis-cyan/20 hover:text-jarvis-cyan/80 hover:border-jarvis-cyan/50",
            isStreaming && "opacity-30 cursor-not-allowed"
          )}
        >
          {isRecording ? (
            <MicOff className="w-5 h-5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
          aria-label="Enviar mensaje"
          className={cn(
            "p-3.5 border transition-all duration-300 active:scale-95",
            input.trim() && !isStreaming
              ? "text-jarvis-cyan border-jarvis-cyan/40 bg-jarvis-cyan/10 hover:bg-jarvis-cyan/25 shadow-[0_0_15px_rgba(0,229,255,0.1)]"
              : "text-jarvis-cyan/20 border-jarvis-cyan/10 cursor-not-allowed"
          )}
        >
          {isStreaming ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </motion.div>
  );
}
