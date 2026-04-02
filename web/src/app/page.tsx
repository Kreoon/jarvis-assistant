"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, 
  MessageSquare, 
  FileText, 
  Users, 
  Zap, 
  Shield, 
  Cpu,
  BarChart3,
  Calendar,
  Settings,
  X,
  Send,
  Loader2,
  Lock
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- HUD Components ---
const GlassPanel = ({ children, className, title }: { children: React.ReactNode, className?: string, title?: string }) => (
  <div className={cn("glass-panel p-4 relative group", className)}>
    <div className="hud-border hud-tl" />
    <div className="hud-border hud-tr" />
    <div className="hud-border hud-bl" />
    <div className="hud-border hud-br" />
    {title && (
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-jarvis-cyan/80 font-bold">{title}</span>
        <div className="h-px bg-jarvis-cyan/20 flex-grow ml-4" />
      </div>
    )}
    {children}
  </div>
);

const IconButton = ({ icon: Icon, active, onClick, label }: { icon: any, active?: boolean, onClick: () => void, label: string }) => (
  <button 
    onClick={onClick}
    className={cn(
      "relative p-3 transition-all duration-300 group",
      active ? "text-jarvis-cyan scale-110" : "text-jarvis-cyan/40 hover:text-jarvis-cyan/80"
    )}
  >
    <Icon className="w-6 h-6" />
    {active && (
      <motion.div 
        layoutId="active-indicator"
        className="absolute inset-0 border border-jarvis-cyan/50 rounded-lg"
        initial={false}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    )}
    <span className="absolute left-16 top-1/2 -translate-y-1/2 bg-jarvis-cyan text-background text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none tracking-widest font-bold">
      {label}
    </span>
  </button>
);

// --- Main Application ---
export default function JarvisHUD() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "chat" | "reports" | "agents">("dashboard");
  const [isLoading, setIsLoading] = useState(true);
  const [authStatus, setAuthStatus] = useState<"locked" | "unlocked">("locked");
  const [token, setToken] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "jarvis", text: string }[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    // Initial scan animation
    setTimeout(() => setIsLoading(false), 2000);
  }, []);

  const handleLogin = () => {
    // Simple mock auth for now
    if (token === "stark-industries-access-2024") {
      setAuthStatus("unlocked");
      fetchStatus();
      fetchReports();
    }
  };

  const fetchStatus = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
      const res = await fetch(`${apiUrl}/api/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setStatus(data);
    } catch {}
  };

  const fetchReports = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
      const res = await fetch(`${apiUrl}/api/reports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setReports(data || []);
    } catch {}
  };

  const sendMessage = async () => {
    if (!input) return;
    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setIsTyping(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || `${window.location.protocol}//${window.location.hostname}:3000`;
      const res = await fetch(`${apiUrl}/api/chat`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: userMsg })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "jarvis", text: data.response }]);
    } catch {
      setMessages(prev => [...prev, { role: "jarvis", text: "Communication failed. Check terminal connection." }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (isLoading) {
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

  if (authStatus === "locked") {
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
              onChange={(e) => setToken(e.target.value)}
              placeholder="ENCRYPTION TOKEN"
              className="w-full bg-black/40 border border-jarvis-cyan/30 p-3 text-center tracking-[0.3em] text-jarvis-cyan focus:outline-none focus:border-jarvis-cyan transition-colors"
            />
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

  return (
    <main className="h-screen w-screen p-4 flex gap-4 overflow-hidden relative">
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

        <div className="mt-auto">
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
              <span className="text-sm">{(status?.uptime / 3600).toFixed(2)} HOURS</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] text-jarvis-cyan/50 tracking-tighter uppercase font-bold">DATA_RELAY</span>
              <span className="text-sm text-green-400">ACTIVE:STABLE</span>
            </div>
          </div>
          
          <div className="flex gap-4 items-center">
            <div className="h-1.5 w-32 bg-jarvis-cyan/10 rounded-full overflow-hidden border border-jarvis-cyan/20">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: "65%" }}
                className="h-full bg-jarvis-cyan shadow-[0_0_10px_var(--jarvis-cyan)]"
              />
            </div>
            <span className="text-[10px] text-jarvis-cyan/60 font-bold">MEMORY: 65%</span>
          </div>
        </GlassPanel>

        {/* Dynamic Display Area */}
        <div className="flex-grow overflow-hidden flex gap-4">
          
          {/* Main View */}
          <div className="flex-grow flex flex-col overflow-hidden">
            <AnimatePresence mode="wait">
              {activeTab === "dashboard" && (
                <motion.div 
                  key="dash"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="grid grid-cols-3 gap-4 h-full"
                >
                  <GlassPanel title="CENTRAL POWER" className="col-span-2">
                    <div className="flex items-center justify-center h-full relative">
                      {/* Animated Orb */}
                      <motion.div 
                        animate={{ scale: [1, 1.1, 1] }} 
                        transition={{ duration: 3, repeat: Infinity }}
                        className="w-48 h-48 rounded-full bg-jarvis-cyan/5 border-2 border-jarvis-cyan/20 flex items-center justify-center relative shadow-[0_0_50px_rgba(0,229,255,0.1)]"
                      >
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                          className="absolute inset-2 border border-dashed border-jarvis-cyan/40 rounded-full"
                        />
                        <div className="w-32 h-32 rounded-full border-4 border-jarvis-cyan shadow-[0_0_30px_var(--jarvis-cyan)] flex items-center justify-center">
                          <Cpu className="w-12 h-12 text-jarvis-cyan animate-pulse" />
                        </div>
                      </motion.div>
                      
                      <div className="absolute top-0 right-0 p-4 grid grid-cols-2 gap-4">
                        <div className="text-right">
                          <div className="text-[8px] text-jarvis-cyan/50 uppercase">LATENCY</div>
                          <div className="text-xl">12MS</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[8px] text-jarvis-cyan/50 uppercase">BANDWIDTH</div>
                        <div className="text-xl">1.2GB/S</div>
                        </div>
                      </div>
                    </div>
                  </GlassPanel>

                  <div className="flex flex-col gap-4">
                    <GlassPanel title="SYSTEM LOGS">
                      <div className="text-[10px] font-mono leading-relaxed text-jarvis-cyan/80">
                        <div className="text-green-400 opacity-80">[OK] Handshake established with Meta API</div>
                        <div className="opacity-80">[INFO] Daily Intelligence Engine scheduled (06:00)</div>
                        <div className="opacity-80">[INFO] CouchDB volume mapped to /opt/couchdb/data</div>
                        <div className="text-yellow-400 opacity-80">[WARN] Memory usage approaching threshold</div>
                        <div className="text-blue-400 opacity-80">[TASK] Parsing 12 active social trends...</div>
                        <div className="opacity-80">[INFO] Google OAuth tokens verified</div>
                      </div>
                    </GlassPanel>
                    <GlassPanel title="ACTIVE TASKS" className="flex-grow">
                      <div className="space-y-4">
                        {[
                          { name: "Brand Research", progress: 85 },
                          { name: "Content Synth", progress: 40 },
                          { name: "Syncing Obsidian", progress: 100 },
                        ].map((t) => (
                          <div key={t.name} className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold">
                              <span>{t.name}</span>
                              <span className="text-jarvis-cyan">{t.progress}%</span>
                            </div>
                            <div className="h-1 bg-jarvis-cyan/10 rounded-full overflow-hidden">
                              <div className="h-full bg-jarvis-cyan" style={{ width: `${t.progress}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </GlassPanel>
                  </div>
                </motion.div>
              )}

              {activeTab === "chat" && (
                <motion.div 
                  key="chat"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col h-full gap-4"
                >
                  <GlassPanel className="flex-grow overflow-y-auto custom-scrollbar flex flex-col p-6">
                    <div className="space-y-6">
                      {messages.map((m, i) => (
                        <div 
                          key={i} 
                          className={cn(
                            "flex flex-col max-w-[80%]",
                            m.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                          )}
                        >
                          <span className="text-[8px] text-jarvis-cyan/50 mb-1 tracking-widest uppercase font-bold">
                            {m.role === "user" ? "ADMIN_ACCESS" : "JARVIS_CORE"}
                          </span>
                          <div className={cn(
                            "p-3 text-sm border",
                            m.role === "user" 
                              ? "bg-jarvis-cyan/10 border-jarvis-cyan/30 text-white" 
                              : "bg-black/40 border-jarvis-cyan/20 text-jarvis-cyan glowing-text"
                          )}>
                            {m.text}
                          </div>
                        </div>
                      ))}
                      {isTyping && (
                        <div className="flex flex-col mr-auto items-start">
                          <span className="text-[8px] text-jarvis-cyan/50 mb-1 tracking-widest uppercase font-bold">JARVIS_CORE</span>
                          <div className="p-3 bg-black/40 border border-jarvis-cyan/20 text-jarvis-cyan italic text-xs animate-pulse">
                            Processing query through neural nodes...
                          </div>
                        </div>
                      )}
                    </div>
                  </GlassPanel>
                  
                  <div className="grid grid-cols-[1fr,auto] gap-4">
                    <input 
                      className="bg-jarvis-glass border border-jarvis-cyan/30 p-4 text-jarvis-cyan focus:outline-none focus:border-jarvis-cyan placeholder:text-jarvis-cyan/20 text-sm tracking-widest"
                      placeholder="ENTER COMMAND FOR JARVIS..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    />
                    <button 
                      onClick={sendMessage}
                      className="aspect-square bg-jarvis-cyan/20 border border-jarvis-cyan/40 p-4 text-jarvis-cyan hover:bg-jarvis-cyan/40 transition-all shadow-[0_0_15px_rgba(0,229,255,0.1)] active:scale-95"
                    >
                      <Send className="w-6 h-6" />
                    </button>
                  </div>
                </motion.div>
              )}

              {activeTab === "agents" && (
                <motion.div 
                  key="agents"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="grid grid-cols-2 md:grid-cols-3 gap-4"
                >
                  {status?.agents?.map((a: any) => (
                    <GlassPanel key={a.name} title={a.name.toUpperCase()} className="h-44 group cursor-pointer hover:border-jarvis-cyan/60 transition-all">
                      <div className="flex flex-col h-full">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="p-2 bg-jarvis-cyan/10 border border-jarvis-cyan/20 rounded">
                            <Zap className="w-5 h-5 text-jarvis-cyan" />
                          </div>
                          <span className="text-xs text-green-400 uppercase tracking-widest font-bold">STABLE</span>
                        </div>
                        <p className="text-[10px] text-jarvis-cyan/60 leading-relaxed group-hover:text-white transition-colors">
                          {a.desc}
                        </p>
                        <div className="mt-auto pt-2 border-t border-jarvis-cyan/10 flex justify-between items-center">
                          <span className="text-[8px] opacity-40">NODEID: {Math.random().toString(16).slice(2, 8)}</span>
                          <BarChart3 className="w-3 h-3 opacity-40" />
                        </div>
                      </div>
                    </GlassPanel>
                  ))}
                </motion.div>
              )}

              {activeTab === "reports" && (
                <motion.div 
                  key="reports"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="h-full space-y-4 overflow-y-auto pr-2 custom-scrollbar"
                >
                  {reports.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-jarvis-cyan/40 p-12 text-center">
                      <FileText className="w-20 h-20 mb-6 opacity-20" />
                      <p className="text-sm tracking-[0.4em] uppercase font-bold mb-2">No Archives Detected</p>
                      <p className="text-[10px] max-w-xs leading-relaxed">
                        NO DAILY INTELLIGENCE REPORTS FOUND IN THE COUCHDB VAULTS. 
                        WAIT FOR THE NEXT SCHEDULED ENGINE RUN (06:00).
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {reports.map((r: any) => (
                        <GlassPanel key={r.id} title={`INTEL_LOG: ${r.date}`} className="h-fit">
                          <div className="space-y-4">
                            <div className="text-[10px] opacity-60 line-clamp-3 font-mono leading-relaxed overflow-hidden h-12">
                              {r.content.slice(0, 300)}...
                            </div>
                            <div className="flex justify-between items-center bg-jarvis-cyan/5 p-2 border border-jarvis-cyan/10">
                              <span className="text-[8px] font-bold">TIMESTAMP: {new Date(r.updatedAt).toLocaleDateString()}</span>
                              <button 
                                onClick={() => {
                                  // In a real app, this would open a full-screen view
                                  setMessages(prev => [...prev, { role: "jarvis", text: `Displaying Data for ${r.date}: \n\n ${r.content.slice(0, 500)}...` }]);
                                  setActiveTab("chat");
                                }}
                                className="text-[10px] text-jarvis-cyan hover:underline hover:glowing-text uppercase font-bold flex items-center gap-1"
                              >
                                <Zap className="w-3 h-3" /> ANALYZE DATA
                              </button>
                            </div>
                          </div>
                        </GlassPanel>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Info Sidebar (HUD Secondary) */}
          <GlassPanel className="w-64 hidden xl:flex flex-col gap-6">
            <div>
              <span className="text-[10px] text-jarvis-cyan/50 tracking-widest font-bold block mb-4">CALENDAR_FLUX</span>
              <div className="space-y-4">
                {[
                  { time: "09:00", event: "Marketing Sync" },
                  { time: "14:30", event: "Content Batching" },
                  { time: "17:00", event: "System Backup" },
                ].map((e) => (
                  <div key={e.time} className="flex gap-3 items-center group">
                    <div className="w-1.5 h-1.5 bg-jarvis-cyan/40 rounded-full group-hover:bg-jarvis-cyan" />
                    <span className="text-[10px] text-jarvis-cyan/80 font-mono">{e.time}</span>
                    <span className="text-[10px] opacity-60 capitalize group-hover:opacity-100 transition-opacity">{e.event}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[10px] text-jarvis-cyan/50 tracking-widest font-bold block mb-4">RESOURCES</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "OAI", status: "UP" },
                  { label: "ANT", status: "UP" },
                  { label: "GGL", status: "UP" },
                  { label: "DB", status: "UP" },
                ].map((r) => (
                  <div key={r.label} className="bg-black/40 border border-jarvis-cyan/10 p-2 text-center">
                    <div className="text-[8px] opacity-40">{r.label}</div>
                    <div className="text-[10px] text-green-400">{r.status}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-auto">
              <span className="text-[8px] text-jarvis-cyan/40 block mb-2">SYSTEM_ID: STARK_ENT_49921_B</span>
              <div className="h-0.5 bg-jarvis-cyan/20 w-full" />
              <div className="mt-2 text-[8px] text-jarvis-cyan/20 flex justify-between">
                <span>©2024 KREOON AI</span>
                <span>SECURE_BY_KROON</span>
              </div>
            </div>
          </GlassPanel>
        </div>
      </div>
    </main>
  );
}
