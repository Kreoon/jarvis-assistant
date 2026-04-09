"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  MessageSquare,
  FileText,
  Users,
  Shield,
  Settings,
  Lock,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from "lucide-react";

import { VoiceStateProvider, useVoiceState } from "@/contexts/VoiceStateContext";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { IconButton } from "@/components/ui/IconButton";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { ReportsPanel } from "@/components/reports/ReportsPanel";
import { AgentFleet } from "@/components/agents/AgentFleet";
import { InfoSidebar } from "@/components/layout/InfoSidebar";
import { VoiceOverlay } from "@/components/voice/VoiceOverlay";
import { MicButton } from "@/components/voice/MicButton";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { JarvisAPI } from "@/lib/api";

type TabId = "dashboard" | "chat" | "reports" | "agents";

// ─── Inner app (has access to VoiceState context) ───────────────────────────

function JarvisApp({ token }: { token: string }) {
  const { api, machineState, dispatch, isIdle, isListening, isProcessing, isSpeaking } = useVoiceState();
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [status, setStatus] = useState<any>(null);

  // Web Speech API - only for live visual transcript feedback
  const {
    start: startWebSpeech,
    stop: stopWebSpeech,
    interimTranscript,
    isSupported: sttSupported,
  } = useSpeechRecognition();

  // Text-to-Speech via ElevenLabs
  const {
    speak,
    stop: stopSpeaking,
  } = useTextToSpeech(token);

  // MediaRecorder for Whisper STT
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Live transcript for overlay
  const [liveTranscript, setLiveTranscript] = useState("");
  const [jarvisResponse, setJarvisResponse] = useState("");

  // Fetch status on mount
  useEffect(() => {
    api.getStatus().then(setStatus).catch(() => {});
  }, [api]);

  // Sync Web Speech interim transcript to live display (visual only)
  useEffect(() => {
    if (interimTranscript) {
      setLiveTranscript(interimTranscript);
    }
  }, [interimTranscript]);

  // Start recording audio for Whisper
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(t => t.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size < 1000) {
          // Too short, ignore
          dispatch({ type: "CANCEL" });
          return;
        }

        // Send to Whisper for transcription + response
        dispatch({ type: "START_PROCESSING" });
        setJarvisResponse("");

        try {
          const result = await api.sendAudio(audioBlob);
          const transcription = result.transcription || "";
          const response = result.response || "No obtuve respuesta.";

          setLiveTranscript(transcription);
          setJarvisResponse(response);

          // Speak response with ElevenLabs
          if (voiceEnabled && response) {
            dispatch({ type: "START_SPEAKING" });
            try {
              await speak(response);
              dispatch({ type: "STOP_SPEAKING" });
            } catch {
              // ElevenLabs failed, still show text response
              dispatch({ type: "STOP_SPEAKING" });
            }
          } else {
            dispatch({ type: "CANCEL" });
          }
        } catch (err) {
          console.error("[Voice] Error:", err);
          dispatch({ type: "ERROR", payload: String(err) });
          setJarvisResponse("Uy parce, hubo un error.");
        } finally {
          setTimeout(() => {
            setJarvisResponse("");
            setLiveTranscript("");
          }, 4000);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250); // Collect chunks every 250ms
    } catch (err) {
      console.error("[Voice] Mic access error:", err);
      dispatch({ type: "ERROR", payload: "No se pudo acceder al microfono" });
    }
  }, [api, dispatch, speak, voiceEnabled]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Handle mic toggle - records audio for Whisper
  const handleMicToggle = useCallback(() => {
    if (isIdle) {
      dispatch({ type: "START_LISTENING" });
      startRecording();
      // Also start Web Speech for live visual transcript
      if (sttSupported) startWebSpeech();
    } else if (isListening) {
      dispatch({ type: "STOP_LISTENING" });
      stopRecording();
      if (sttSupported) stopWebSpeech();
    } else if (isSpeaking) {
      // Barge-in: stop speaking, start listening again
      dispatch({ type: "BARGE_IN" });
      stopSpeaking();
      startRecording();
      if (sttSupported) startWebSpeech();
    }
  }, [isIdle, isListening, isSpeaking, dispatch, startRecording, stopRecording, startWebSpeech, stopWebSpeech, stopSpeaking, sttSupported]);

  return (
    <main className="h-screen w-screen p-4 flex gap-4 overflow-hidden relative">
      {/* Scanline effect */}
      <div className="scanline" />

      {/* Side Navigation HUD */}
      <GlassPanel className="w-20 flex flex-col items-center py-6 gap-8">
        <div className="w-10 h-10 bg-jarvis-cyan/10 rounded-full flex items-center justify-center border border-jarvis-cyan/40 shadow-[0_0_10px_var(--jarvis-cyan)]">
          <Shield className="w-5 h-5 text-jarvis-cyan" />
        </div>

        <div className="flex flex-col gap-4">
          <IconButton icon={Activity} active={activeTab === "dashboard"} onClick={() => setActiveTab("dashboard")} label="DIAGNOSTICS" />
          <IconButton icon={MessageSquare} active={activeTab === "chat"} onClick={() => setActiveTab("chat")} label="COMMUNICATION" />
          <IconButton icon={FileText} active={activeTab === "reports"} onClick={() => setActiveTab("reports")} label="REPORTS" />
          <IconButton icon={Users} active={activeTab === "agents"} onClick={() => setActiveTab("agents")} label="AGENT FLEET" />
        </div>

        <div className="mt-auto flex flex-col gap-4">
          {/* Voice toggle */}
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-3 transition-all duration-300 ${voiceEnabled ? "text-jarvis-cyan" : "text-jarvis-cyan/30"}`}
            title={voiceEnabled ? "Voice enabled" : "Voice disabled"}
          >
            {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <IconButton icon={Settings} onClick={() => {}} label="SYSTEM CONFIG" />
        </div>
      </GlassPanel>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col gap-4 overflow-hidden">

        {/* Top Status HUD */}
        <GlassPanel className="h-16 flex items-center justify-between px-6">
          <div className="flex gap-12">
            <div className="flex flex-col">
              <span className="text-[8px] text-jarvis-cyan/50 tracking-tighter uppercase font-bold">CORE_PROCESSOR</span>
              <span className="text-sm glowing-text">JARVIS-OS_V2.0.0</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] text-jarvis-cyan/50 tracking-tighter uppercase font-bold">SYSTEM_UPTIME</span>
              <span className="text-sm">{status?.uptime ? `${(status.uptime / 3600).toFixed(2)} HOURS` : "..."}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] text-jarvis-cyan/50 tracking-tighter uppercase font-bold">VOICE_STATE</span>
              <span className={`text-sm ${isListening ? "text-yellow-400" : isProcessing ? "text-orange-400 animate-pulse" : isSpeaking ? "text-green-400" : "text-green-400"}`}>
                {machineState.state.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex gap-4 items-center">
            <div className={`h-1.5 w-32 bg-jarvis-cyan/10 rounded-full overflow-hidden border border-jarvis-cyan/20`}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: isProcessing ? "100%" : isSpeaking ? "80%" : isListening ? "50%" : "20%" }}
                transition={{ duration: isProcessing ? 2 : 0.5, repeat: isProcessing ? Infinity : 0, repeatType: "reverse" }}
                className="h-full bg-jarvis-cyan shadow-[0_0_10px_var(--jarvis-cyan)]"
              />
            </div>
            <span className="text-[10px] text-jarvis-cyan/60 font-bold">
              {isProcessing ? "PROCESSING..." : isSpeaking ? "SPEAKING" : isListening ? "LISTENING" : "READY"}
            </span>
          </div>
        </GlassPanel>

        {/* Dynamic Display Area */}
        <div className="flex-grow overflow-hidden flex gap-4">
          <div className="flex-grow flex flex-col overflow-hidden">
            <AnimatePresence mode="wait">
              {activeTab === "dashboard" && (
                <motion.div
                  key="dash"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="h-full"
                >
                  <Dashboard api={api} />
                </motion.div>
              )}

              {activeTab === "chat" && (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="h-full relative"
                >
                  <ChatPanel api={api} />
                  {/* Floating mic button */}
                  {voiceEnabled && (
                    <div className="absolute bottom-20 right-4 z-20">
                      <MicButton onToggle={handleMicToggle} />
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === "reports" && (
                <motion.div
                  key="reports"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="h-full"
                >
                  <ReportsPanel api={api} />
                </motion.div>
              )}

              {activeTab === "agents" && (
                <motion.div
                  key="agents"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="h-full"
                >
                  <AgentFleet api={api} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Info Sidebar */}
          <div className="w-64 hidden xl:flex">
            <InfoSidebar api={api} />
          </div>
        </div>
      </div>

      {/* Voice Overlay (shown during voice interaction) */}
      <VoiceOverlay
        transcript={isListening ? (liveTranscript || interimTranscript) : ""}
        response={isProcessing || isSpeaking ? jarvisResponse : ""}
      />

      {/* Global mic button (all tabs except chat which has its own) */}
      {voiceEnabled && activeTab !== "chat" && (
        <div className="fixed bottom-8 right-8 z-30">
          <MicButton onToggle={handleMicToggle} />
        </div>
      )}
    </main>
  );
}

// ─── Login Screen ───────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState(false);

  const handleLogin = () => {
    if (token.length > 0) {
      onLogin(token);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center p-6">
      <GlassPanel className="w-full max-w-md p-10" title="Security Clearance Required">
        <div className="flex flex-col items-center gap-6">
          <div className="p-4 rounded-full bg-jarvis-cyan/10 border border-jarvis-cyan/30 text-jarvis-cyan">
            <Lock className="w-12 h-12" />
          </div>
          <p className="text-center text-xs text-jarvis-cyan/60 leading-relaxed">
            ACCESS RESTRICTED TO STARK INDUSTRIES AUTHORIZED PERSONNEL ONLY.
            PLEASE ENTER ENCRYPTION TOKEN TO COMMENCE HANDSHAKE.
          </p>
          <input
            type="password"
            value={token}
            onChange={(e) => { setToken(e.target.value); setError(false); }}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="ENCRYPTION TOKEN"
            className="w-full bg-black/40 border border-jarvis-cyan/30 p-3 text-center tracking-[0.3em] text-jarvis-cyan focus:outline-none focus:border-jarvis-cyan transition-colors"
          />
          {error && (
            <p className="text-red-400 text-[10px] tracking-widest">INVALID CREDENTIALS</p>
          )}
          <button
            onClick={handleLogin}
            className="w-full bg-jarvis-cyan/20 border border-jarvis-cyan/50 p-3 hover:bg-jarvis-cyan/40 transition-colors text-jarvis-cyan font-bold tracking-widest text-xs"
          >
            INITIALIZE PROTOCOLS
          </button>
        </div>
      </GlassPanel>
    </div>
  );
}

// ─── Loading Screen ─────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-background">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        className="relative w-32 h-32"
      >
        <div className="absolute inset-0 border-4 border-jarvis-cyan/20 rounded-full" />
        <div className="absolute inset-0 border-t-4 border-jarvis-cyan rounded-full shadow-[0_0_20px_var(--jarvis-cyan)]" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-8 text-jarvis-cyan tracking-[0.5em] text-sm uppercase font-bold"
      >
        Initializing JARVIS Protocols...
      </motion.div>
    </div>
  );
}

// ─── Root Component ─────────────────────────────────────────────────────────

export default function JarvisHUD() {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Check for stored token
    const stored = typeof window !== "undefined" ? localStorage.getItem("jarvis-token") : null;
    if (stored) {
      setToken(stored);
    }
    setTimeout(() => setIsLoading(false), 2000);
  }, []);

  const handleLogin = (t: string) => {
    setToken(t);
    localStorage.setItem("jarvis-token", t);
  };

  if (isLoading) return <LoadingScreen />;
  if (!token) return <LoginScreen onLogin={handleLogin} />;

  return (
    <VoiceStateProvider token={token}>
      <JarvisApp token={token} />
    </VoiceStateProvider>
  );
}
