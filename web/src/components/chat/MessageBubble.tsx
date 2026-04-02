"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "../../lib/cn";

interface MessageBubbleProps {
  role: "user" | "jarvis";
  text: string;
  timestamp?: number;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ role, text, timestamp }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "flex flex-col max-w-[82%]",
        isUser ? "ml-auto items-end" : "mr-auto items-start"
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        {!isUser && (
          <span className="text-[8px] text-jarvis-cyan/50 tracking-widest uppercase font-bold">
            JARVIS_CORE
          </span>
        )}
        {timestamp && (
          <span className="text-[8px] text-jarvis-cyan/30 font-mono">
            {formatTimestamp(timestamp)}
          </span>
        )}
        {isUser && (
          <span className="text-[8px] text-jarvis-cyan/50 tracking-widest uppercase font-bold">
            ADMIN_ACCESS
          </span>
        )}
      </div>

      {isUser ? (
        <div className="p-3 text-sm border bg-jarvis-cyan/10 border-jarvis-cyan/30 text-white leading-relaxed">
          {text}
        </div>
      ) : (
        <div className="p-3 text-sm border bg-black/40 border-jarvis-cyan/20 text-jarvis-cyan glowing-text leading-relaxed w-full">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className ?? "");
                const isBlock = !!match;
                if (isBlock) {
                  return (
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{
                        background: "rgba(0,0,0,0.6)",
                        border: "1px solid rgba(0,229,255,0.15)",
                        borderRadius: 0,
                        fontSize: "11px",
                        margin: "8px 0",
                      }}
                    >
                      {String(children).replace(/\n$/, "")}
                    </SyntaxHighlighter>
                  );
                }
                return (
                  <code
                    className="bg-black/60 border border-jarvis-cyan/20 px-1 py-0.5 text-[11px] font-mono text-jarvis-cyan"
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              p({ children }) {
                return <p className="mb-2 last:mb-0">{children}</p>;
              },
              ul({ children }) {
                return (
                  <ul className="list-disc list-inside space-y-1 mb-2 text-jarvis-cyan/80">
                    {children}
                  </ul>
                );
              },
              ol({ children }) {
                return (
                  <ol className="list-decimal list-inside space-y-1 mb-2 text-jarvis-cyan/80">
                    {children}
                  </ol>
                );
              },
              strong({ children }) {
                return <strong className="text-white font-bold">{children}</strong>;
              },
              h1({ children }) {
                return (
                  <h1 className="text-base font-bold text-white tracking-widest uppercase mb-2">
                    {children}
                  </h1>
                );
              },
              h2({ children }) {
                return (
                  <h2 className="text-sm font-bold text-jarvis-cyan tracking-widest uppercase mb-2">
                    {children}
                  </h2>
                );
              },
              h3({ children }) {
                return (
                  <h3 className="text-xs font-bold text-jarvis-cyan/80 tracking-wider uppercase mb-1">
                    {children}
                  </h3>
                );
              },
              blockquote({ children }) {
                return (
                  <blockquote className="border-l-2 border-jarvis-cyan/40 pl-3 italic text-jarvis-cyan/60 my-2">
                    {children}
                  </blockquote>
                );
              },
              a({ href, children }) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-jarvis-blue underline hover:text-jarvis-cyan transition-colors"
                  >
                    {children}
                  </a>
                );
              },
            }}
          >
            {text}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
}
