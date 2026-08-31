"use client";

import { useEffect, useRef, useState } from "react";
import { MODEL_OPTIONS } from "@/lib/constants";
import { Check, ChevronDown } from "@/components/ui/icons";

/** "Muse Glimmer 30B" → { primary: "Muse Glimmer", secondary: "30B" }
 *  Mirrors Claude's "Sonnet 5" + "Medium" split. */
function splitLabel(label: string) {
  const parts = label.trim().split(/\s+/);
  if (parts.length <= 1) return { primary: label, secondary: "" };
  return {
    primary: parts.slice(0, -1).join(" "),
    secondary: parts[parts.length - 1],
  };
}

export default function ModelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const current = MODEL_OPTIONS.find((o) => o.id === value) ?? MODEL_OPTIONS[0];
  const { primary, secondary } = splitLabel(current.label);

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-label="Select model"
        className="flex min-w-0 max-w-full items-center gap-1 rounded-lg px-1.5 py-1.5 text-xs transition hover:bg-[var(--hover)] sm:px-2.5 sm:text-sm"
      >
        {/* whitespace-nowrap + truncate = can never stack to 3 lines */}
        <span className="min-w-0 truncate whitespace-nowrap font-medium text-[var(--text)]">
          {primary}
        </span>
        {secondary && (
          <span className="min-w-0 truncate whitespace-nowrap text-[var(--muted)]">
            {secondary}
          </span>
        )}
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-[var(--muted)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          style={{ transformOrigin: "bottom right" }}
          className="animate-pop absolute bottom-full right-0 z-50 mb-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-black/20"
        >
          <p className="border-b border-[var(--border)] px-3 py-2 text-[11px] uppercase tracking-wider text-[var(--muted)]">
            Model
          </p>
          <div className="max-h-72 overflow-y-auto">
            {MODEL_OPTIONS.map((o) => {
              const parts = splitLabel(o.label);
              return (
                <button
                  key={o.id}
                  onClick={() => {
                    onChange(o.id);
                    setOpen(false);
                  }}
                  className={`flex w-full min-w-0 items-center gap-2 px-3 py-2.5 text-left text-sm transition ${
                    o.id === value
                      ? "bg-[var(--hover)] text-[var(--text)]"
                      : "text-[var(--text)] hover:bg-[var(--hover)]"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {parts.primary}{" "}
                      {parts.secondary && (
                        <span className="text-[var(--muted)]">{parts.secondary}</span>
                      )}
                    </span>
                    <span className="block truncate text-[11px] text-[var(--muted)]">
                      {o.id}
                    </span>
                  </span>
                  {o.id === value && (
                    <Check className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}