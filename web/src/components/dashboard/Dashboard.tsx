"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, AlertCircle } from "lucide-react";
import { GlassPanel } from "../ui/GlassPanel";
import { VoiceOrb } from "../voice/VoiceOrb";
import { OrbParticles } from "../voice/OrbParticles";
import { JarvisAPI, MetricsData, LogEntry, JobEntry } from "../../lib/api";

interface DashboardProps {
  api: JarvisAPI;
}

interface MetricsDisplay {
  memoryMB: string;
  uptimeHours: string;
  cpu: string;
}

interface JobDisplay {
  id: string;
  description: string;
  enabled: boolean;
  lastRun: string | null;
}

function parseMetrics(raw: MetricsData): MetricsDisplay {
  const memRss =
    typeof raw.memoryRss === "number"
      ? raw.memoryRss
      : typeof (raw as Record<string, unknown>)["process.memoryUsage.rss"] === "number"
      ? (raw as Record<string, unknown>)["process.memoryUsage.rss"] as number
      : null;

  const uptime =
    typeof raw.uptime === "number"
      ? raw.uptime
      : typeof (raw as Record<string, unknown>).uptimeSeconds === "number"
      ? (raw as Record<string, unknown>).uptimeSeconds as number
      : null;

  const cpu =
    typeof raw.cpu === "number"
      ? raw.cpu
      : typeof (raw as Record<string, unknown>)["process.cpuUsage"] === "number"
      ? (raw as Record<string, unknown>)["process.cpuUsage"] as number
      : null;

  return {
    memoryMB: memRss !== null ? `${(memRss / 1024 / 1024).toFixed(1)} MB` : "—",
    uptimeHours: uptime !== null ? `${(uptime / 3600).toFixed(2)} H` : "—",
    cpu: cpu !== null ? `${(cpu as number).toFixed(1)}%` : "—",
  };
}

function parseJobs(raw: JobEntry[]): JobDisplay[] {
  return raw.map((j) => ({
    id: j.id,
    description:
      (j as Record<string, unknown>).description as string ??
      (j as Record<string, unknown>).name as string ??
      j.id,
    enabled:
      (j as Record<string, unknown>).enabled !== undefined
        ? Boolean((j as Record<string, unknown>).enabled)
        : j.status === "active",
    lastRun:
      (j as Record<string, unknown>).lastRun as string ??
      (j as Record<string, unknown>).scheduledAt as string ??
      null,
  }));
}

const LOG_LEVEL_COLOR: Record<string, string> = {
  error: "text-red-400",
  warn: "text-yellow-400",
  info: "text-jarvis-cyan/80",
  debug: "text-jarvis-cyan/40",
};

function logColor(level: string): string {
  return LOG_LEVEL_COLOR[level.toLowerCase()] ?? "text-jarvis-cyan/60";
}

function logPrefix(level: string): string {
  const l = level.toLowerCase();
  if (l === "error") return "[ERR]";
  if (l === "warn") return "[WARN]";
  if (l === "debug") return "[DBG]";
  return "[INFO]";
}

export function Dashboard({ api }: DashboardProps) {
  const [metrics, setMetrics] = useState<MetricsDisplay | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [jobs, setJobs] = useState<JobDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [metricsRaw, logsRaw, jobsRaw] = await Promise.all([
        api.getMetrics(),
        api.getLogs(20),
        api.getJobs(),
      ]);
      setMetrics(parseMetrics(metricsRaw));
      setLogs(Array.isArray(logsRaw) ? logsRaw : []);
      setJobs(Array.isArray(jobsRaw) ? parseJobs(jobsRaw) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexion con el servidor");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="grid grid-cols-3 gap-4 h-full"
    >
      {/* Central orb panel */}
      <GlassPanel title="CENTRAL_POWER" className="col-span-2 flex flex-col">
        <div className="flex items-center justify-center flex-grow relative min-h-0">
          {/* Orb + particles */}
          <div className="relative w-48 h-48">
            <OrbParticles width={192} height={192} />
            <div className="absolute inset-0 flex items-center justify-center">
              <VoiceOrb />
            </div>
          </div>

          {/* Metrics overlay — top right */}
          <div className="absolute top-0 right-0 p-4 grid grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-3 flex items-center gap-1 text-jarvis-cyan/40">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-[9px] tracking-widest">LOADING...</span>
              </div>
            ) : error ? (
              <div className="col-span-3 flex items-center gap-1 text-red-400/70">
                <AlertCircle className="w-3 h-3" />
                <span className="text-[9px] tracking-widest">OFFLINE</span>
              </div>
            ) : (
              <>
                <div className="text-right">
                  <div className="text-[8px] text-jarvis-cyan/50 uppercase tracking-tight">MEMORY</div>
                  <div className="text-lg font-bold text-jarvis-cyan">{metrics?.memoryMB}</div>
                </div>
                <div className="text-right">
                  <div className="text-[8px] text-jarvis-cyan/50 uppercase tracking-tight">UPTIME</div>
                  <div className="text-lg font-bold">{metrics?.uptimeHours}</div>
                </div>
                <div className="text-right">
                  <div className="text-[8px] text-jarvis-cyan/50 uppercase tracking-tight">CPU</div>
                  <div className="text-lg font-bold">{metrics?.cpu}</div>
                </div>
              </>
            )}
          </div>

          {/* Status badges — bottom left */}
          <div className="absolute bottom-0 left-0 p-4 flex gap-3">
            <div className="text-[8px] text-green-400 border border-green-400/30 px-2 py-0.5 bg-green-400/5">
              DATA_RELAY: ACTIVE
            </div>
            <div className="text-[8px] text-jarvis-cyan/60 border border-jarvis-cyan/20 px-2 py-0.5 bg-jarvis-cyan/5">
              SECURE_CHANNEL
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* Right column: logs + jobs */}
      <div className="flex flex-col gap-4 overflow-hidden">
        {/* System logs */}
        <GlassPanel title="SYSTEM_LOGS" className="flex-shrink-0 h-1/2">
          {loading ? (
            <div className="flex items-center gap-2 text-jarvis-cyan/40">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-[9px] tracking-widest">LOADING LOGS...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-[9px] text-jarvis-cyan/30 tracking-widest">
              NO LOGS AVAILABLE
            </div>
          ) : (
            <div className="text-[10px] font-mono leading-relaxed space-y-0.5 overflow-y-auto h-full custom-scrollbar pr-1">
              {logs.map((log, i) => {
                const level = String(
                  (log as Record<string, unknown>).level ??
                  (log as Record<string, unknown>).severity ??
                  "info"
                );
                const msg = String(
                  (log as Record<string, unknown>).msg ??
                  (log as Record<string, unknown>).message ??
                  log
                );
                const time = String(
                  (log as Record<string, unknown>).time ??
                  log.timestamp ??
                  ""
                );
                const shortTime = time
                  ? new Date(time).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })
                  : "";

                return (
                  <div key={i} className={`flex gap-2 ${logColor(level)}`}>
                    <span className="opacity-40 shrink-0 font-bold">{logPrefix(level)}</span>
                    <span className="opacity-50 shrink-0 font-mono text-[9px]">{shortTime}</span>
                    <span className="truncate">{msg}</span>
                  </div>
                );
              })}
            </div>
          )}
        </GlassPanel>

        {/* Active tasks / jobs */}
        <GlassPanel title="ACTIVE_TASKS" className="flex-grow overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center gap-2 text-jarvis-cyan/40">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-[9px] tracking-widest">LOADING TASKS...</span>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-[9px] text-jarvis-cyan/30 tracking-widest">
              NO ACTIVE TASKS
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div key={job.id} className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="truncate max-w-[70%]">{job.description}</span>
                    <span
                      className={
                        job.enabled ? "text-green-400" : "text-jarvis-cyan/30"
                      }
                    >
                      {job.enabled ? "ON" : "OFF"}
                    </span>
                  </div>
                  {job.lastRun && (
                    <div className="text-[8px] text-jarvis-cyan/30 font-mono">
                      LAST:{" "}
                      {new Date(job.lastRun).toLocaleString([], {
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                  <div className="h-0.5 bg-jarvis-cyan/10 w-full">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: job.enabled ? "100%" : "15%" }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-full ${job.enabled ? "bg-jarvis-cyan" : "bg-jarvis-cyan/20"}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>
    </motion.div>
  );
}
