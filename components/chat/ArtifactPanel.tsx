"use client";

import { useState } from "react";
import type { Artifact } from "@/store/chat-store";
import type { SVGProps } from "react";

/* ---------- Inline icons (self-contained, nothing to import) ---------- */

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

const Check = (p: IconProps) => (
  <Icon {...p}><path d="M20 6 9 17l-5-5" /></Icon>
);

const Code = (p: IconProps) => (
  <Icon {...p}>
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </Icon>
);

const Copy = (p: IconProps) => (
  <Icon {...p}>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </Icon>
);

const Download = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </Icon>
);

const Eye = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

const X = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Icon>
);

/* ---------- ArtifactPanel ---------- */

const PREVIEWABLE = ["html", "xml", "svg"];

function extFor(lang: string) {
  if (lang === "html" || lang === "xml") return "html";
  if (lang === "svg") return "svg";
  if (lang === "javascript" || lang === "js") return "js";
  if (lang === "typescript" || lang === "ts") return "ts";
  if (lang === "python" || lang === "py") return "py";
  if (lang === "css") return "css";
  return "txt";
}

export default function ArtifactPanel({
  artifact,
  onClose,
}: {
  artifact: Artifact;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"preview" | "code">(
    PREVIEWABLE.includes(artifact.lang) ? "preview" : "code"
  );
  const [copied, setCopied] = useState(false);

  const canPreview = PREVIEWABLE.includes(artifact.lang);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const download = () => {
    const blob = new Blob([artifact.code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.title.replace(/[^\w\d-]+/g, "-").toLowerCase()}.${extFor(artifact.lang)}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); // revoke later so the download isn't cancelled
  };

  const openInTab = () => {
    const blob = new Blob([artifact.code], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  return (
    <div className="flex h-full w-full flex-col border-l border-[var(--border)] bg-[var(--bg-main)]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
        {/* Tabs */}
        <div className="flex items-center rounded-lg bg-[var(--hover)] p-0.5">
          {canPreview ? (
            <>
              <button
                onClick={() => setTab("preview")}
                title="Preview"
                className={`rounded-md p-1.5 transition ${
                  tab === "preview"
                    ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                    : "text-[var(--muted)]"
                }`}
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => setTab("code")}
                title="Code"
                className={`rounded-md p-1.5 transition ${
                  tab === "code"
                    ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
                    : "text-[var(--muted)]"
                }`}
              >
                <Code className="h-4 w-4" />
              </button>
            </>
          ) : (
            <span className="flex items-center gap-1.5 px-2 py-1 text-xs text-[var(--muted)]">
              <Code className="h-3.5 w-3.5" /> Code
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{artifact.title}</p>
          <p className="truncate text-[11px] text-[var(--muted)]">
            Code - {artifact.lang.toUpperCase()}
          </p>
        </div>

        <button
          onClick={copy}
          title="Copy code"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[var(--muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          onClick={download}
          title="Download"
          className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
        >
          <Download className="h-4 w-4" />
        </button>
        {canPreview && (
          <button
            onClick={openInTab}
            title="Open in new tab"
            className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            </svg>
          </button>
        )}
        <button
          onClick={onClose}
          title="Close panel"
          className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      {tab === "preview" && canPreview ? (
        <iframe
          title="Artifact preview"
          sandbox="allow-scripts"
          srcDoc={artifact.code}
          className="h-full w-full flex-1 bg-white"
        />
      ) : (
        <pre className="h-full w-full flex-1 overflow-auto bg-[var(--code-bg)] p-4 text-[13px] leading-6 text-[var(--text)]">
          <code>{artifact.code}</code>
        </pre>
      )}
    </div>
  );
}