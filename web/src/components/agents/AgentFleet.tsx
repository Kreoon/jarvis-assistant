"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  X,
  Send,
  Loader2,
  AlertCircle,
  Wrench,
  Activity,
} from "lucide-react";
import { GlassPanel } from "../ui/GlassPanel";
import { JarvisAPI, AgentInfo } from "../../lib/api";
import { cn } from "../../lib/cn";

interface AgentFleetProps {
  api: JarvisAPI;
}

interface AgentMessage {
  id: string;
  role: "user" | "agent";
  text: string;
}

interface AgentWithTools extends AgentInfo {
  tools?: string[];
}

function parseTools(agent: AgentInfo): string[] {
  const raw = (agent as unknown as Record<string, unknown>).tools;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") return raw.split(",").map((s) => s.trim());
  return [];
}

function statusColor(status?: string): string {
  if (!status) return "text-jarvis-cyan/40";
  const s = status.toLowerCase();
  if (s === "active" || s === "online" || s === "stable") return "text-green-400";
  if (s === "error" || s === "offline") return "text-red-400";
  if (s === "busy" || s === "processing") return "text-yellow-400";
  return "text-jarvis-cyan/60";
}

function statusLabel(status?: string): string {
  if (!status) return "UNKNOWN";
  return status.toUpperCase();
}

export function AgentFleet({ api }: AgentFleetProps) {
  const [agents, setAgents] = useState<AgentWithTools[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeAgent, setActiveAgent] = useState<AgentWithTools | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchAgents = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getAgents();
      const enriched: AgentWithTools[] = (Array.isArray(data) ? data : []).map(
        (a) => ({ ...a, tools: parseTools(a) })
      );
      setAgents(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar agentes");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const openAgent = (agent: AgentWithTools) => {
    setActiveAgent(agent);
    setMessages([]);
    setInput("");
    setStreamingText("");
  };

  const closeAgent = () => {
    abortRef.current?.abort();
    setActiveAgent(null);
    setMessages([]);
    setIsStreaming(false);
  };

  const handleSend = () => {
    if (!input.trim() || !activeAgent || isStreaming) return;

    const userMsg: AgentMessage = {
      id: `${Date.now()}`,
      role: "user",
      text: input.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);
    setStreamingText("");

    abortRef.current?.abort();
    abortRef.current = api.agentInteract(
      activeAgent.name,
      userMsg.text,
      (partial) => setStreamingText(partial),
      (full) => {
        setIsStreaming(false);
        setStreamingText("");
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-r`,
            role: "agent",
            text: full || "Sin respuesta del agente.",
          },
        ]);
      }
    );
  };

  return (
    <motion.div
      key="agents"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="h-full flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-1">
        <span className="text-[9px] text-jarvis-cyan/40 uppercase tracking-widest font-bold">
          AGENT_FLEET :: {agents.length} NODES
        </span>
        {loading && <Loader2 className="w-3 h-3 animate-spin text-jarvis-cyan/40" />}
        {error && (
          <span className="text-[9px] text-red-400/70 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {error}
          </span>
        )}
      </div>

      {/* Agent grid */}
      <div className="flex-grow overflow-y-auto custom-scrollbar pr-1">
        {!loading && agents.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-jarvis-cyan/40 p-12 text-center">
            <Activity className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-xs tracking-[0.4em] uppercase font-bold mb-2">
              No Agents Detected
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <motion.div
                key={agent.name}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
              >
                <GlassPanel
                  title={agent.name.toUpperCase()}
                  className="h-48 cursor-pointer hover:border-jarvis-cyan/50 transition-all group"
                  key={agent.name}
                >
                  <button
                    onClick={() => openAgent(agent)}
                    className="flex flex-col h-full w-full text-left"
                    aria-label={`Interactuar con agente ${agent.name}`}
                  >
                    {/* Status row */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 bg-jarvis-cyan/10 border border-jarvis-cyan/20 rounded">
                        <Zap className="w-4 h-4 text-jarvis-cyan" />
                      </div>
                      <span
                        className={cn(
                          "text-[9px] uppercase tracking-widest font-bold",
                          statusColor(agent.status)
                        )}
                      >
                        {statusLabel(agent.status ?? "STABLE")}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-[10px] text-jarvis-cyan/60 leading-relaxed group-hover:text-jarvis-cyan/90 transition-colors flex-grow line-clamp-3">
                      {agent.desc}
                    </p>

                    {/* Tools */}
                    {agent.tools && agent.tools.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {agent.tools.slice(0, 3).map((tool) => (
                          <span
                            key={tool}
                            className="text-[8px] bg-jarvis-cyan/5 border border-jarvis-cyan/15 px-1.5 py-0.5 text-jarvis-cyan/50 flex items-center gap-0.5"
                          >
                            <Wrench className="w-2 h-2" />
                            {tool}
                          </span>
                        ))}
                        {agent.tools.length > 3 && (
                          <span className="text-[8px] text-jarvis-cyan/30">
                            +{agent.tools.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="mt-auto pt-2 border-t border-jarvis-cyan/10 flex justify-between items-center">
                      <span className="text-[8px] opacity-30 font-mono">
                        NODEID:{" "}
                        {agent.name.slice(0, 6).toUpperCase().padEnd(6, "0")}
                      </span>
                      <span className="text-[8px] text-jarvis-cyan/40 group-hover:text-jarvis-cyan transition-colors font-bold tracking-widest">
                        INTERACT →
                      </span>
                    </div>
                  </button>
                </GlassPanel>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Interaction modal */}
      <AnimatePresence>
        {activeAgent && (
          <motion.div
            key="agent-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && closeAgent()}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-2xl max-h-[80vh] flex flex-col"
            >
              <GlassPanel className="flex flex-col h-full overflow-hidden">
                {/* Modal header */}
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-jarvis-cyan/15">
                  <div>
                    <span className="text-[9px] text-jarvis-cyan/50 tracking-widest uppercase font-bold">
                      AGENT_NODE ::
                    </span>{" "}
                    <span className="text-sm font-bold text-jarvis-cyan tracking-widest">
                      {activeAgent.name.toUpperCase()}
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {activeAgent.tools?.map((tool) => (
                        <span
                          key={tool}
                          className="text-[8px] bg-jarvis-cyan/5 border border-jarvis-cyan/15 px-1.5 py-0.5 text-jarvis-cyan/40 flex items-center gap-0.5"
                        >
                          <Wrench className="w-2 h-2" />
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={closeAgent}
                    aria-label="Cerrar"
                    className="p-1.5 text-jarvis-cyan/40 hover:text-jarvis-cyan transition-colors border border-jarvis-cyan/20 hover:border-jarvis-cyan/50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Message list */}
                <div className="flex-grow overflow-y-auto custom-scrollbar pr-1 space-y-4 min-h-0 mb-4">
                  {messages.length === 0 && !isStreaming && (
                    <div className="text-center text-jarvis-cyan/30 text-[10px] tracking-widest py-8 uppercase">
                      Inicia la comunicacion con {activeAgent.name}
                    </div>
                  )}
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex flex-col max-w-[85%]",
                        msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      <span className="text-[8px] text-jarvis-cyan/40 mb-1 tracking-widest uppercase font-bold">
                        {msg.role === "user"
                          ? "ADMIN"
                          : activeAgent.name.toUpperCase()}
                      </span>
                      <div
                        className={cn(
                          "p-3 text-xs border leading-relaxed",
                          msg.role === "user"
                            ? "bg-jarvis-cyan/10 border-jarvis-cyan/30 text-white"
                            : "bg-black/40 border-jarvis-cyan/20 text-jarvis-cyan"
                        )}
                      >
                        {msg.text}
                      </div>
                    </div>
                  ))}

                  {isStreaming && (
                    <div className="flex flex-col mr-auto items-start max-w-[85%]">
                      <span className="text-[8px] text-jarvis-cyan/40 mb-1 tracking-widest uppercase font-bold">
                        {activeAgent.name.toUpperCase()}
                      </span>
                      <div className="p-3 bg-black/40 border border-jarvis-cyan/20 text-jarvis-cyan text-xs">
                        {streamingText || (
                          <span className="flex items-center gap-2 italic opacity-60">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Procesando...
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Input row */}
                <div className="flex gap-2">
                  <input
                    className="flex-grow bg-jarvis-glass border border-jarvis-cyan/30 p-3 text-jarvis-cyan focus:outline-none focus:border-jarvis-cyan placeholder:text-jarvis-cyan/20 text-xs tracking-widest disabled:opacity-40"
                    placeholder={`ENVIAR MENSAJE A ${activeAgent.name.toUpperCase()}...`}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && !e.shiftKey && handleSend()
                    }
                    disabled={isStreaming}
                    aria-label="Mensaje para el agente"
                  />
                  <button
                    onClick={handleSend}
                    disabled={isStreaming || !input.trim()}
                    aria-label="Enviar"
                    className={cn(
                      "p-3 border transition-all duration-300 active:scale-95",
                      input.trim() && !isStreaming
                        ? "text-jarvis-cyan border-jarvis-cyan/40 bg-jarvis-cyan/10 hover:bg-jarvis-cyan/25"
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
              </GlassPanel>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
