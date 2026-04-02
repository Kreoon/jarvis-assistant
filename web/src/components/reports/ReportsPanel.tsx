"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  Zap,
  X,
  Download,
  Loader2,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { GlassPanel } from "../ui/GlassPanel";
import { JarvisAPI, ReportEntry } from "../../lib/api";
import { cn } from "../../lib/cn";

interface ReportsPanelProps {
  api: JarvisAPI;
}

export function ReportsPanel({ api }: ReportsPanelProps) {
  const [reports, setReports] = useState<ReportEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReportEntry | null>(null);
  const [engineRunning, setEngineRunning] = useState(false);
  const [engineLog, setEngineLog] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      setError(null);
      const data = await api.getReports();
      setReports(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar reportes");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleTriggerEngine = () => {
    if (engineRunning) {
      abortRef.current?.abort();
      setEngineRunning(false);
      return;
    }

    setEngineRunning(true);
    setEngineLog(["[INIT] Iniciando Intelligence Engine..."]);

    abortRef.current = api.triggerEngine(
      (progress) => {
        setEngineLog((prev) => {
          // Progress es el texto acumulado — tomamos la ultima linea
          const lines = progress.split("\n").filter(Boolean);
          const last = lines[lines.length - 1];
          if (!last) return prev;
          if (prev[prev.length - 1] === last) return prev;
          return [...prev, last];
        });
      },
      (report) => {
        setEngineRunning(false);
        setEngineLog((prev) => [...prev, "[DONE] Reporte generado correctamente."]);
        setReports((prev) => {
          const exists = prev.some((r) => r.id === report.id);
          return exists ? prev : [report, ...prev];
        });
      }
    );
  };

  const handleDownload = (report: ReportEntry) => {
    const content = `JARVIS INTELLIGENCE REPORT\nDate: ${report.date}\nGenerated: ${report.updatedAt}\n\n${report.content}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jarvis-report-${report.date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      key="reports"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="h-full flex flex-col gap-4"
    >
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[9px] text-jarvis-cyan/40 uppercase tracking-widest font-bold">
            INTEL_ARCHIVE :: {reports.length} LOGS
          </span>
          {loading && <Loader2 className="w-3 h-3 animate-spin text-jarvis-cyan/40" />}
          {error && (
            <span className="text-[9px] text-red-400/70 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {error}
            </span>
          )}
        </div>

        {/* Engine button */}
        <button
          onClick={handleTriggerEngine}
          aria-label={engineRunning ? "Detener engine" : "Ejecutar engine"}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold tracking-widest border transition-all duration-300",
            engineRunning
              ? "text-yellow-400 border-yellow-400/40 bg-yellow-400/10 animate-pulse"
              : "text-jarvis-cyan border-jarvis-cyan/30 bg-jarvis-cyan/5 hover:bg-jarvis-cyan/20 hover:border-jarvis-cyan/60"
          )}
        >
          {engineRunning ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              RUNNING ENGINE...
            </>
          ) : (
            <>
              <Zap className="w-3 h-3" />
              TRIGGER ENGINE
            </>
          )}
        </button>
      </div>

      {/* Engine log */}
      <AnimatePresence>
        {engineLog.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <GlassPanel className="overflow-hidden">
              <div className="text-[9px] font-mono space-y-0.5 max-h-24 overflow-y-auto custom-scrollbar">
                {engineLog.map((line, i) => (
                  <div key={i} className="text-jarvis-cyan/60 leading-relaxed">
                    {line}
                  </div>
                ))}
              </div>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reports grid */}
      <div className="flex-grow overflow-y-auto custom-scrollbar pr-1">
        {!loading && reports.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-jarvis-cyan/40 p-12 text-center">
            <FileText className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-xs tracking-[0.4em] uppercase font-bold mb-2">
              No Archives Detected
            </p>
            <p className="text-[10px] max-w-xs leading-relaxed">
              No se encontraron reportes en los vaults de CouchDB.
              Ejecuta el Intelligence Engine para generar uno.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reports.map((report) => (
              <motion.div
                key={report.id}
                whileHover={{ scale: 1.01 }}
                transition={{ duration: 0.15 }}
              >
                <GlassPanel
                  title={`INTEL_LOG: ${report.date}`}
                  className="cursor-pointer hover:border-jarvis-cyan/50 transition-colors h-fit"
                >
                  <div className="space-y-3">
                    {/* Preview */}
                    <div className="text-[10px] opacity-60 font-mono leading-relaxed line-clamp-3 h-[3.6rem] overflow-hidden">
                      {report.content.slice(0, 280)}...
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-center bg-jarvis-cyan/5 p-2 border border-jarvis-cyan/10">
                      <span className="text-[8px] font-bold text-jarvis-cyan/40">
                        TS: {new Date(report.updatedAt).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleDownload(report)}
                          aria-label="Descargar reporte"
                          className="text-[9px] text-jarvis-cyan/40 hover:text-jarvis-cyan transition-colors flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => setSelected(report)}
                          aria-label="Ver reporte completo"
                          className="text-[10px] text-jarvis-cyan hover:underline uppercase font-bold flex items-center gap-1"
                        >
                          <ChevronRight className="w-3 h-3" />
                          VER
                        </button>
                      </div>
                    </div>
                  </div>
                </GlassPanel>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Full report modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            key="report-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-full max-w-4xl max-h-[85vh] flex flex-col"
            >
              <GlassPanel
                title={`INTEL_LOG: ${selected.date}`}
                className="flex flex-col h-full overflow-hidden"
              >
                {/* Modal header */}
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-jarvis-cyan/15">
                  <div className="flex items-center gap-4">
                    <span className="text-[9px] text-jarvis-cyan/40 font-mono">
                      ID: {selected.id}
                    </span>
                    <span className="text-[9px] text-jarvis-cyan/40 font-mono">
                      UPDATED: {new Date(selected.updatedAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload(selected)}
                      aria-label="Descargar"
                      className="flex items-center gap-1 text-[9px] text-jarvis-cyan/60 hover:text-jarvis-cyan border border-jarvis-cyan/20 hover:border-jarvis-cyan/50 px-2 py-1 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      DOWNLOAD
                    </button>
                    <button
                      onClick={() => setSelected(null)}
                      aria-label="Cerrar"
                      className="p-1.5 text-jarvis-cyan/40 hover:text-jarvis-cyan transition-colors border border-jarvis-cyan/20 hover:border-jarvis-cyan/50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Report content */}
                <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 text-sm text-jarvis-cyan/80 leading-relaxed prose-invert">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => (
                        <p className="mb-3 text-jarvis-cyan/80">{children}</p>
                      ),
                      h1: ({ children }) => (
                        <h1 className="text-base font-bold text-white tracking-widest uppercase mb-3 mt-4">
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2 className="text-sm font-bold text-jarvis-cyan tracking-widest uppercase mb-2 mt-3 border-b border-jarvis-cyan/15 pb-1">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-xs font-bold text-jarvis-cyan/80 uppercase mb-1 mt-2">
                          {children}
                        </h3>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-inside space-y-1 mb-3 text-jarvis-cyan/70">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal list-inside space-y-1 mb-3 text-jarvis-cyan/70">
                          {children}
                        </ol>
                      ),
                      strong: ({ children }) => (
                        <strong className="text-white font-bold">{children}</strong>
                      ),
                      code: ({ children }) => (
                        <code className="bg-black/60 border border-jarvis-cyan/20 px-1 py-0.5 text-[11px] font-mono text-jarvis-cyan">
                          {children}
                        </code>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-jarvis-cyan/40 pl-3 italic text-jarvis-cyan/50 my-2">
                          {children}
                        </blockquote>
                      ),
                    }}
                  >
                    {selected.content}
                  </ReactMarkdown>
                </div>
              </GlassPanel>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
