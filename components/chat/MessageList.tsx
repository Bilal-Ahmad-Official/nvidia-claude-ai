"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "@/types";
import MessageBubble from "./MessageBubble";
import { ArrowDown } from "@/components/ui/icons";

/** Pixels from bottom within which we treat the user as "pinned" to the bottom */
const PIN_THRESHOLD = 80;

export default function MessageList({
  messages,
  isStreaming,
  onRetry,
}: {
  messages: Message[];
  isStreaming: boolean;
  onRetry: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);
  const prevCount = useRef(0);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPinned(distance < PIN_THRESHOLD);
  }, []);

  // New message added → smooth glide down
  useEffect(() => {
    const grew = messages.length > prevCount.current;
    prevCount.current = messages.length;
    if (grew) {
      setPinned(true);
      requestAnimationFrame(() => scrollToBottom(true));
    }
  }, [messages.length, scrollToBottom]);

  // Streaming tokens → instant re-pin each frame (no bounce)
  useEffect(() => {
    if (!isStreaming || !pinned) return;
    let raf = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [messages, isStreaming, pinned]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="stream-scroll h-full overflow-y-auto"
      >
        <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
          {messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            const waitingAssistant =
              m.role === "assistant" &&
              m.content === "" &&
              !(isStreaming && isLast);
            if (waitingAssistant) return null;
            return (
              <div key={m.id} className="animate-fade-in">
                <MessageBubble
                  message={m}
                  streaming={isStreaming && isLast}
                  isLast={isLast}
                  onRetry={onRetry}
                />
              </div>
            );
          })}
          <div className="h-2" />
        </div>
      </div>

      {!pinned && messages.length > 0 && (
        <button
          onClick={() => {
            setPinned(true);
            scrollToBottom(true);
          }}
          title="Scroll to latest"
          className="animate-pop absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-[var(--border)] bg-[var(--surface)] p-2.5 text-[var(--text)] shadow-lg shadow-black/10 transition hover:bg-[var(--hover)]"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}