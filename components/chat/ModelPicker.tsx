"use client";

import { useEffect, useRef, useState } from "react";
import { MODEL_OPTIONS } from "@/lib/constants";
import { Check, ChevronDown } from "@/components/ui/icons";

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

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[var(--muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
      >
        {current.label}
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          style={{ transformOrigin: "bottom right" }}
          className="animate-pop absolute bottom-full right-0 z-50 mb-2 w-64 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-black/20"
        >
          <p className="border-b border-[var(--border)] px-3 py-2 text-[11px] uppercase tracking-wider text-[var(--muted)]">
            Model
          </p>
          <div className="max-h-72 overflow-y-auto">
            {MODEL_OPTIONS.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition ${
                  o.id === value
                    ? "bg-[var(--hover)] text-[var(--text)]"
                    : "text-[var(--text)] hover:bg-[var(--hover)]"
                }`}
              >
                <span className="flex-1">
                  {o.label}
                  <span className="block truncate text-[11px] text-[var(--muted)]">
                    {o.id}
                  </span>
                </span>
                {o.id === value && (
                  <Check className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}