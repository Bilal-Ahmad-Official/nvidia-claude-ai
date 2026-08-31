"use client";

import { useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from "react";
import type { Attachment } from "@/types";
import { useChatStore } from "@/store/chat-store";
import ModelPicker from "./ModelPicker";
import { ArrowUp, Brain, FileText, Plus, StopSquare, X } from "@/components/ui/icons";

const MAX_FILE_KB = 100;
const MAX_IMAGE_MB = 8;
const MAX_FILES = 5;

type PendingFile = Attachment;

function imageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1024;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

export default function ChatInput({
  onSend,
  onStop,
  streaming,
  placeholder = "How can I help you today?",
}: {
  onSend: (text: string, files: Attachment[]) => void;
  onStop: () => void;
  streaming: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const deepThink = useChatStore((s) => s.deepThink);
  const setDeepThink = useChatStore((s) => s.setDeepThink);
  const model = useChatStore((s) => s.model);
  const setModel = useChatStore((s) => s.setModel);

  const send = () => {
    if (streaming || (!text.trim() && files.length === 0)) return;
    onSend(text, files);
    setText("");
    setFiles([]);
    if (taRef.current) taRef.current.style.height = "auto";
  };

  const onChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleFiles = async (picked: File[]) => {
    for (const f of picked) {
      if (files.length >= MAX_FILES) {
        alert(`Max ${MAX_FILES} files per message`);
        break;
      }
      const isImage = f.type.startsWith("image/");
      if (isImage) {
        if (f.size > MAX_IMAGE_MB * 1024 * 1024) {
          alert(`"${f.name}" is larger than ${MAX_IMAGE_MB}MB`);
          continue;
        }
        try {
          const dataUrl = await imageToDataUrl(f);
          setFiles((p) => [...p, { name: f.name, size: f.size, kind: "image", dataUrl }]);
        } catch {
          alert(`Could not read "${f.name}"`);
        }
      } else {
        if (f.size > MAX_FILE_KB * 1024) {
          alert(`"${f.name}" is larger than ${MAX_FILE_KB}KB`);
          continue;
        }
        try {
          const content = await f.text();
          setFiles((p) => [...p, { name: f.name, size: f.size, kind: "text", content }]);
        } catch {
          alert(`Could not read "${f.name}"`);
        }
      }
    }
  };

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(Array.from(e.dataTransfer.files ?? []));
  };

  return (
    // ✅ AFTER — centered, Claude-style width on desktop
      <div className="mx-auto w-full max-w-3xl px-3 pb-2 pt-1 sm:px-4 sm:pb-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative w-full max-w-full rounded-[24px] border bg-[var(--surface)] shadow-[0_2px_16px_rgba(0,0,0,0.06)] transition focus-within:border-[var(--accent)]/70 ${
          dragOver ? "border-[var(--accent)]" : "border-[var(--border)]"
        }`}
      >
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[24px] bg-[var(--bg-main)]/80 text-sm text-[var(--muted)]">
            Drop files to attach
          </div>
        )}

        {/* Attachment chips */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3 sm:px-4">
            {files.map((f) => (
              <div key={f.name + f.size} className="group/chip relative shrink-0">
                {f.kind === "image" && f.dataUrl ? (
                  <div className="h-16 w-16 overflow-hidden rounded-xl border border-[var(--border)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.dataUrl} alt={f.name} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--hover)] px-3 py-1.5 text-xs text-[var(--text)]">
                    <FileText className="h-3 w-3 shrink-0 text-[var(--accent)]" />
                    <span className="min-w-0 max-w-[100px] truncate sm:max-w-[160px]">{f.name}</span>
                    <span className="shrink-0 text-[var(--muted)]">
                      {Math.max(1, Math.round(f.size / 1024))}KB
                    </span>
                  </span>
                )}
                <button
                  onClick={() => setFiles((p) => p.filter((x) => x !== f))}
                  aria-label={`Remove ${f.name}`}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--text)] text-[var(--bg-main)] opacity-100 transition sm:opacity-0 sm:group-hover/chip:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={taRef}
          rows={2}
          value={text}
          onChange={onChange}
          onKeyDown={handleKey}
          placeholder={placeholder}
          className="max-h-[200px] w-full max-w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[16px] outline-none placeholder:text-[var(--muted)] sm:px-5"
        />

        {/* ── Claude-style single-line toolbar ──
            Left:  + | Chat/Cowork
            Right: brain | model | send           */}
        <div className="flex flex-nowrap items-center gap-1 px-2 pb-2 pt-1 sm:gap-1.5 sm:px-3">
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            accept=".txt,.md,.markdown,.csv,.json,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.cs,.go,.rs,.rb,.php,.sql,.html,.css,.xml,.yaml,.yml,.sh,.log,image/png,image/jpeg,image/webp,image/gif"
            onChange={pick}
          />

          {/* Attach */}
          <button
            onClick={() => fileInput.current?.click()}
            title="Attach files (text, code, images)"
            className="shrink-0 rounded-full p-2 text-[var(--muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
          >
            <Plus className="h-5 w-5" />
          </button>

          {/* Chat / Cowork — compact, like Claude */}
          <div className="flex shrink-0 items-center rounded-full bg-[var(--hover)] p-0.5 text-[11px] sm:text-xs">
            <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 font-medium text-[var(--text)] shadow-sm sm:px-3">
              Chat
            </span>
            <button
              title="Coming soon"
              className="rounded-full px-2.5 py-1 text-[var(--muted)] sm:px-3"
            >
              Cowork
            </button>
          </div>

          {/* Right cluster — brain | model | send */}
          <div className="ml-auto flex min-w-0 items-center gap-0.5 sm:gap-1">
            {/* DeepThink */}
            <button
              onClick={() => setDeepThink(!deepThink)}
              title="Extended thinking"
              className={`shrink-0 rounded-full p-1.5 transition sm:p-2 ${
                deepThink
                  ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                  : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)]"
              }`}
            >
              <Brain className="h-[18px] w-[18px]" />
            </button>

            {/* Model picker — truncates, never overflows */}
            <div className="min-w-0 max-w-[40vw] sm:max-w-[220px]">
              <ModelPicker value={model} onChange={setModel} />
            </div>

            {streaming ? (
              <button
                onClick={onStop}
                title="Stop generating"
                className="ml-0.5 shrink-0 rounded-full bg-[var(--text)] p-2 text-[var(--bg-main)] transition hover:opacity-80 sm:p-2.5"
              >
                <StopSquare />
              </button>
            ) : (
              <button
                onClick={send}
                disabled={!text.trim() && files.length === 0}
                title="Send"
                className="ml-0.5 shrink-0 rounded-full bg-[var(--accent)] p-2 text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-[var(--hover)] disabled:text-[var(--muted)] sm:p-2.5"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] text-[var(--muted)] opacity-70">
        Claude can make mistakes. Please double-check responses.
      </p>
    </div>
  );
}