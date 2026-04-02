"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Paperclip, X, Send, FileText, Image } from "lucide-react";
import { cn } from "../../lib/cn";

interface FileUploadProps {
  onFileSelected: (file: File, message?: string) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = {
  "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"],
  "application/pdf": [".pdf"],
  "text/plain": [".txt", ".md"],
  "application/json": [".json"],
};

export function FileUpload({ onFileSelected, disabled }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    disabled,
    noClick: true,
  });

  const handleClear = () => {
    if (preview) URL.revokeObjectURL(preview);
    setSelectedFile(null);
    setPreview(null);
    setCaption("");
  };

  const handleSend = () => {
    if (!selectedFile) return;
    onFileSelected(selectedFile, caption.trim() || undefined);
    handleClear();
  };

  const isImage = selectedFile?.type.startsWith("image/");

  return (
    <div {...getRootProps()} className="relative">
      <input {...getInputProps()} />

      {/* Drag overlay — shown over entire area when dragging */}
      {isDragActive && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 border-2 border-dashed border-jarvis-cyan/60 pointer-events-none">
          <div className="text-jarvis-cyan/80 text-xs tracking-widest uppercase font-bold animate-pulse">
            DROP FILE TO UPLOAD
          </div>
          <div className="mt-2 text-jarvis-cyan/40 text-[10px] tracking-widest">
            Images, PDF, TXT, JSON
          </div>
        </div>
      )}

      {/* Compact upload bar — shown when file is selected */}
      {selectedFile && (
        <div className="mb-2 bg-black/60 border border-jarvis-cyan/30 p-2 flex items-center gap-3">
          {/* Preview or icon */}
          {isImage && preview ? (
            <img
              src={preview}
              alt="preview"
              className="w-10 h-10 object-cover border border-jarvis-cyan/20"
            />
          ) : (
            <div className="w-10 h-10 flex items-center justify-center border border-jarvis-cyan/20 bg-jarvis-cyan/5">
              {isImage ? (
                <Image className="w-5 h-5 text-jarvis-cyan/60" />
              ) : (
                <FileText className="w-5 h-5 text-jarvis-cyan/60" />
              )}
            </div>
          )}

          {/* Filename + caption input */}
          <div className="flex-grow min-w-0">
            <div className="text-[9px] text-jarvis-cyan/50 uppercase tracking-widest mb-0.5 truncate">
              {selectedFile.name}
            </div>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="ADD CAPTION (OPTIONAL)..."
              className="w-full bg-transparent border-b border-jarvis-cyan/20 text-jarvis-cyan text-[11px] tracking-widest placeholder:text-jarvis-cyan/20 focus:outline-none focus:border-jarvis-cyan pb-0.5"
            />
          </div>

          {/* Actions */}
          <button
            onClick={handleSend}
            aria-label="Send file"
            className="p-1.5 text-jarvis-cyan hover:text-white hover:bg-jarvis-cyan/20 transition-colors border border-jarvis-cyan/30"
          >
            <Send className="w-4 h-4" />
          </button>
          <button
            onClick={handleClear}
            aria-label="Remove file"
            className="p-1.5 text-jarvis-cyan/40 hover:text-red-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Paperclip trigger */}
      <button
        type="button"
        onClick={open}
        disabled={disabled}
        aria-label="Attach file"
        className={cn(
          "p-3 transition-colors border border-jarvis-cyan/20 hover:border-jarvis-cyan/50",
          selectedFile
            ? "text-jarvis-cyan bg-jarvis-cyan/10"
            : "text-jarvis-cyan/40 hover:text-jarvis-cyan/80",
          disabled && "opacity-30 cursor-not-allowed"
        )}
      >
        <Paperclip className="w-5 h-5" />
      </button>
    </div>
  );
}
