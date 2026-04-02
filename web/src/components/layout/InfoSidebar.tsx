"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Loader2, Calendar, Wifi, WifiOff } from "lucide-react";
import { GlassPanel } from "../ui/GlassPanel";
import { JarvisAPI, CalendarEvent } from "../../lib/api";
import { cn } from "../../lib/cn";

interface InfoSidebarProps {
  api: JarvisAPI;
}

interface ProviderStatus {
  label: string;
  key: string;
  up: boolean;
}

function formatEventTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.slice(0, 10);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return "HOY";
    if (d.toDateString() === tomorrow.toDateString()) return "MAÑANA";
    return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
  } catch {
    return "—";
  }
}

// Interpreta el status de la API para extraer providers
// Backend sends: { providers: { anthropic: true, gemini: true, openai: true, ... } }
function parseProviders(statusRaw: unknown): ProviderStatus[] {
  if (!statusRaw || typeof statusRaw !== "object") {
    return DEFAULT_PROVIDERS;
  }

  const s = statusRaw as Record<string, unknown>;
  // Providers can be at root level or nested under .providers
  const p = (typeof s.providers === "object" && s.providers !== null ? s.providers : s) as Record<string, unknown>;

  const providerMap: { label: string; keys: string[] }[] = [
    { label: "OAI", keys: ["openai", "openAI", "oai"] },
    { label: "ANT", keys: ["anthropic", "claude", "ant"] },
    { label: "GGL", keys: ["gemini", "google", "ggl"] },
    { label: "11L", keys: ["elevenlabs", "tts"] },
    { label: "PPX", keys: ["perplexity", "search"] },
    { label: "DB", keys: ["db", "database", "couchdb"] },
  ];

  return providerMap.map(({ label, keys }) => {
    const found = keys.find((k) => k in p);
    const up = found ? Boolean(p[found]) : false;
    return { label, key: found ?? keys[0], up };
  });
}

const DEFAULT_PROVIDERS: ProviderStatus[] = [
  { label: "OAI", key: "openai", up: false },
  { label: "ANT", key: "anthropic", up: false },
  { label: "GGL", key: "google", up: false },
  { label: "DB", key: "db", up: false },
  { label: "META", key: "meta", up: false },
  { label: "CAL", key: "calendar", up: false },
];

export function InfoSidebar({ api }: InfoSidebarProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>(DEFAULT_PROVIDERS);
  const [loadingCal, setLoadingCal] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const fetchCalendar = useCallback(async () => {
    try {
      const data = await api.getCalendarEvents(7);
      setEvents(Array.isArray(data) ? data.slice(0, 8) : []);
    } catch {
      setEvents([]);
    } finally {
      setLoadingCal(false);
    }
  }, [api]);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.getStatus();
      setProviders(parseProviders(data));
    } catch {
      setProviders(DEFAULT_PROVIDERS);
    } finally {
      setLoadingStatus(false);
    }
  }, [api]);

  useEffect(() => {
    fetchCalendar();
    fetchStatus();

    const interval = setInterval(() => {
      fetchCalendar();
      fetchStatus();
    }, 60_000);

    return () => clearInterval(interval);
  }, [fetchCalendar, fetchStatus]);

  const upCount = providers.filter((p) => p.up).length;

  return (
    <GlassPanel className="w-64 hidden xl:flex flex-col gap-5 overflow-y-auto custom-scrollbar">
      {/* Calendar section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-jarvis-cyan/50 tracking-widest font-bold uppercase">
            CALENDAR_FLUX
          </span>
          {loadingCal && (
            <Loader2 className="w-3 h-3 animate-spin text-jarvis-cyan/30" />
          )}
        </div>

        {events.length === 0 && !loadingCal ? (
          <div className="flex items-center gap-2 text-jarvis-cyan/25 py-2">
            <Calendar className="w-4 h-4" />
            <span className="text-[9px] tracking-widest uppercase">
              Sin eventos
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="flex gap-2 items-start group">
                <div className="mt-1 w-1.5 h-1.5 bg-jarvis-cyan/40 rounded-full group-hover:bg-jarvis-cyan shrink-0 transition-colors" />
                <div className="min-w-0">
                  <div className="text-[8px] text-jarvis-cyan/40 font-mono leading-none mb-0.5">
                    {formatEventDate(event.start)} · {formatEventTime(event.start)}
                  </div>
                  <span className="text-[10px] opacity-70 capitalize group-hover:opacity-100 transition-opacity leading-tight block truncate">
                    {event.summary}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Separator */}
      <div className="h-px bg-jarvis-cyan/10 w-full" />

      {/* Provider status grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-jarvis-cyan/50 tracking-widest font-bold uppercase">
            RESOURCES
          </span>
          {loadingStatus ? (
            <Loader2 className="w-3 h-3 animate-spin text-jarvis-cyan/30" />
          ) : (
            <span className="text-[8px] text-jarvis-cyan/30 font-mono">
              {upCount}/{providers.length} UP
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {providers.map((p) => (
            <div
              key={p.label}
              className={cn(
                "bg-black/40 border p-1.5 text-center transition-colors duration-500",
                p.up
                  ? "border-jarvis-cyan/15 bg-jarvis-cyan/5"
                  : "border-jarvis-cyan/5"
              )}
              title={p.key}
            >
              <div className="text-[8px] opacity-40 mb-0.5 font-bold">{p.label}</div>
              <div className="flex items-center justify-center gap-0.5">
                {p.up ? (
                  <>
                    <Wifi className="w-2 h-2 text-green-400" />
                    <span className="text-[8px] text-green-400 font-bold">UP</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-2 h-2 text-jarvis-cyan/20" />
                    <span className="text-[8px] text-jarvis-cyan/20">—</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-3 border-t border-jarvis-cyan/10">
        <span className="text-[8px] text-jarvis-cyan/30 block mb-1 font-mono">
          SYSTEM_ID: KREOON_JV2_49921
        </span>
        <div className="h-px bg-jarvis-cyan/10 w-full mb-2" />
        <div className="text-[8px] text-jarvis-cyan/20 flex justify-between">
          <span>©2025 KREOON AI</span>
          <span>SECURE_LINK</span>
        </div>
      </div>
    </GlassPanel>
  );
}
