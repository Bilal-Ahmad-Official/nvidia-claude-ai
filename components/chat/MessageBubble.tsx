"use client";

import { useEffect, useRef, useState } from "react";
import type { Message } from "@/types";
import { useChatStore, type Artifact } from "@/store/chat-store";
import Markdown from "@/components/ui/Markdown";
import CopyButton from "@/components/ui/CopyButton";
import {
  ChevronDown,
  Code,
  Download,
  FileText,
  RotateCcw,
  Sunburst,
  ThumbsDown,
  ThumbsUp,
} from "@/components/ui/icons";

const PREVIEWABLE = ["html", "xml", "svg"];

function Votes() {
  const [vote, setVote] = useState<0 | 1 | -1>(0);
  const base = "rounded p-1 transition hover:text-[var(--text)]";

  return (
    <div className="flex gap-0.5">
      <button
        title="Good response"
        onClick={() => setVote(vote === 1 ? 0 : 1)}
        className={`${base} ${vote === 1 ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        title="Bad response"
        onClick={() => setVote(vote === -1 ? 0 : -1)}
        className={`${base} ${vote === -1 ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function parseThink(content: string) {
  const openIdx = content.indexOf("<think>");
  if (openIdx === -1) {
    return { thinking: "", answer: content, thinkOpen: false, hasThink: false };
  }
  const closeIdx = content.indexOf("</think>", openIdx);
  const thinking = content.slice(
    openIdx + 7,
    closeIdx === -1 ? content.length : closeIdx
  );
  const answer =
    closeIdx === -1 ? "" : content.slice(closeIdx + 8).replace(/^\s+/, "");
  return { thinking, answer, thinkOpen: closeIdx === -1, hasThink: true };
}

/** Find the first long fenced code block worth promoting to an artifact */
function findArtifact(answer: string): Artifact | null {
  const re = /```([\w#+.-]*)\r?\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(answer)) !== null) {
    const lang = (m[1] || "code").toLowerCase();
    const code = m[2];
    if (code.split("\n").length < 12) continue;

    let title = "Untitled";
    if (lang === "html" || lang === "xml") {
      const t = code.match(/<title>(.*?)<\/title>/i);
      if (t) title = t[1].trim();
    }
    if (title === "Untitled" && lang === "svg") title = "SVG graphic";

    return { title, lang, code };
  }
  return null;
}

function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const setArtifact = useChatStore((s) => s.setArtifact);

  const download = (e: React.MouseEvent) => {
    e.stopPropagation();
    const blob = new Blob([artifact.code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.title.replace(/[^\w\d-]+/g, "-").toLowerCase()}.${artifact.lang === "svg" ? "svg" : "html"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={() => setArtifact(artifact)}
      className="my-3 flex w-full items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left transition hover:border-[var(--accent)]/50 hover:bg-[var(--hover)]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--hover)] text-[var(--accent)]">
        <Code className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-[var(--text)]">
          {artifact.title}
        </span>
        <span className="block text-xs text-[var(--muted)]">
          Code - {artifact.lang.toUpperCase()}
          {PREVIEWABLE.includes(artifact.lang) ? " - Click to preview" : ""}
        </span>
      </span>
      <span
        onClick={download}
        title="Download"
        className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text)] transition hover:bg-[var(--hover)]"
      >
        <Download className="inline h-3.5 w-3.5" /> Download
      </span>
    </button>
  );
}

function ThinkPanel({
  text,
  open,
  onToggle,
  live,
}: {
  text: string;
  open: boolean;
  onToggle: () => void;
  live: boolean;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (live && open && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [text, live, open]);

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--muted)] transition hover:bg-[var(--hover)]"
      >
        <Sunburst
          className={`h-3.5 w-3.5 text-[var(--accent)] ${live ? "animate-pulse" : ""}`}
        />
        <span className={live ? "text-[var(--text)]" : ""}>
          {live ? "Thinking..." : "Extended thinking"}
        </span>
        <span className="ml-auto text-[10px] text-[var(--muted)] opacity-70">
          {text.length.toLocaleString()} chars
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          ref={bodyRef}
          className="max-h-64 overflow-y-auto border-t border-[var(--border)] px-3 py-2"
        >
          <p className="whitespace-pre-wrap text-[13px] italic leading-6 text-[var(--muted)]">
            {text}
            {live && <span className="streaming-cursor ml-0.5">|</span>}
          </p>
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({
  message,
  streaming = false,
  isLast = false,
  onRetry,
}: {
  message: Message;
  streaming?: boolean;
  isLast?: boolean;
  onRetry?: () => void;
}) {
  const { thinking, answer, thinkOpen, hasThink } = parseThink(message.content);
  const artifact = findArtifact(answer);
  const setArtifact = useChatStore((s) => s.setArtifact);

  // Auto-open the panel when generation finishes with an artifact
  const wasStreaming = useRef(streaming);
  useEffect(() => {
    if (wasStreaming.current && !streaming && artifact && isLast) {
      setArtifact(artifact);
    }
    wasStreaming.current = streaming;
  }, [streaming, artifact, isLast, setArtifact]);

  const [manual, setManual] = useState<boolean | null>(null);
  const wasOpen = useRef(thinkOpen);
  useEffect(() => {
    if (thinkOpen !== wasOpen.current) {
      if (wasOpen.current && !thinkOpen) setManual(false);
      wasOpen.current = thinkOpen;
    }
  }, [thinkOpen]);
  const panelOpen = manual ?? thinkOpen;

  if (message.role === "user") {
    const hasFiles = !!message.attachments?.length;
    const typed = hasFiles ? message.content.split("\n\n---\n")[0] : message.content;
    const images = (message.attachments ?? []).filter(
      (a) => a.kind === "image" && a.dataUrl
    );
    const textFiles = (message.attachments ?? []).filter((a) => a.kind === "text");

    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-[var(--bubble-user)] px-4 py-3">
          {images.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {images.map((a) => (
                <img
                  key={a.name + a.size}
                  src={a.dataUrl}
                  alt={a.name}
                  className="max-h-48 max-w-[240px] rounded-xl object-cover"
                />
              ))}
            </div>
          )}

          {textFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {textFiles.map((a) => (
                <span
                  key={a.name}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--text)]"
                >
                  <FileText className="h-3 w-3 text-[var(--accent)]" />
                  {a.name}
                </span>
              ))}
            </div>
          )}

          {typed && (
            <p className="whitespace-pre-wrap text-[15px] leading-7">{typed}</p>
          )}
        </div>
      </div>
    );
  }

  const thinkingLive = streaming && thinkOpen;
  const showCursor = streaming && !thinkOpen;

  // Split answer around the artifact code block
  let before = answer;
  let after = "";
  if (artifact) {
    const idx = answer.indexOf("```" + artifact.lang);
    if (idx !== -1) {
      const end = answer.indexOf("```", idx + 3 + artifact.lang.length);
      if (end !== -1) {
        before = answer.slice(0, idx);
        after = answer.slice(end + 3);
      }
    }
  }

  return (
    <div className="group flex gap-3">
      <Sunburst
        className={`mt-1.5 h-5 w-5 shrink-0 text-[var(--accent)] ${
          streaming && !answer ? "animate-pulse" : ""
        }`}
      />
      <div className="min-w-0 flex-1">
        {hasThink && thinking.length > 0 && (
          <ThinkPanel
            text={thinking}
            open={panelOpen}
            live={thinkingLive}
            onToggle={() => setManual(!panelOpen)}
          />
        )}

        <div className="text-[15px] leading-7 text-[var(--text)]">
          {answer ? (
            <>
              <Markdown content={before} />
              {artifact && <ArtifactCard artifact={artifact} />}
              {after.trim() && <Markdown content={after} />}
              {showCursor && <span className="streaming-cursor ml-0.5">|</span>}
            </>
          ) : !hasThink ? (
            <span className="streaming-cursor text-lg">|</span>
          ) : null}
        </div>

        {answer && !streaming && (
          <div className="mt-1.5 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            <CopyButton text={answer} className="text-[var(--muted)]" />
            {isLast && onRetry && (
              <button
                onClick={onRetry}
                title="Retry"
                className="rounded p-1 text-[var(--muted)] transition hover:text-[var(--text)]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
            <Votes />
          </div>
        )}
      </div>
    </div>
  );
}