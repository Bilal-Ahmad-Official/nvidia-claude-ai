"use client";

import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/store/chat-store";
import { useChat } from "@/hooks/useChat";
import Sidebar from "@/components/sidebar/Sidebar";
import ThemeToggle from "@/components/ThemeToggle";
import ArtifactPanel from "./ArtifactPanel";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import { PanelLeft, Sunburst } from "@/components/ui/icons";

export default function ChatContainer() {
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { messages, isStreaming, sendMessage, stop, retry } = useChat();
  const deepThink = useChatStore((s) => s.deepThink);
  const artifact = useChatStore((s) => s.artifact);
  const setArtifact = useChatStore((s) => s.setArtifact);
  const activeId = useChatStore((s) => s.activeId);
  const activeConversation = useChatStore((s) =>
    s.conversations.find((c) => c.id === s.activeId)
  );

  // Close the artifact panel when switching chats
  const prevId = useRef(activeId);
  useEffect(() => {
    if (activeId !== prevId.current) {
      setArtifact(null);
      prevId.current = activeId;
    }
  }, [activeId, setArtifact]);

  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg-main)]">
        <Sunburst className="h-8 w-8 text-[var(--accent)]" />
      </div>
    );
  }

  const empty = messages.length === 0;
  const h = new Date().getHours();
  const greeting =
    h < 5
      ? "Hey, night owl"
      : h < 12
        ? "Good morning"
        : h < 18
          ? "Good afternoon"
          : "Good evening";

  const input = (
    <ChatInput
      onSend={sendMessage}
      onStop={stop}
      streaming={isStreaming}
      placeholder={
        deepThink
          ? "DeepThink enabled - ask something hard..."
          : "How can I help you today?"
      }
    />
  );

  return (
    <div className="relative flex h-screen overflow-hidden bg-[var(--bg-main)] text-[var(--text)]">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCollapse={() => setSidebarOpen(false)}
      />

      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          title="Open sidebar"
          className="absolute left-3 top-3 z-20 rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
        >
          <PanelLeft />
        </button>
      )}

      <div className="flex min-w-0 flex-1">
        {/* Chat column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {empty ? (
            <div className="relative flex flex-1 flex-col items-center justify-center px-4">
              <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-[var(--surface)] px-4 py-1.5 text-xs text-[var(--muted)]">
                Free plan -{" "}
                <span className="cursor-pointer text-[var(--accent)] underline underline-offset-2">
                  Upgrade
                </span>
              </div>

              <div className="absolute right-3 top-3">
                <ThemeToggle />
              </div>

              <div className="w-full max-w-3xl pb-10">
                <div className="mb-8 flex items-center justify-center gap-4">
                  <Sunburst className="h-9 w-9 shrink-0 text-[var(--accent)] sm:h-12 sm:w-12" />
                  <h1 className="text-center font-serif text-4xl sm:text-5xl">
                    {greeting}
                  </h1>
                </div>
                {input}
              </div>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-2 px-4 py-3">
                <button
                  onClick={() => setSidebarOpen((v) => !v)}
                  className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
                  title="Toggle sidebar"
                >
                  <PanelLeft />
                </button>
                <span className="min-w-0 truncate text-sm text-[var(--muted)]">
                  {activeConversation?.title}
                </span>
                <div className="ml-auto">
                  <ThemeToggle />
                </div>
              </header>

              <MessageList
                messages={messages}
                isStreaming={isStreaming}
                onRetry={retry}
              />
              <div>{input}</div>
            </>
          )}
        </div>

        {/* Artifact side panel */}
        {artifact && (
          <div className="hidden w-[46%] min-w-[420px] max-w-[720px] md:block">
            <ArtifactPanel
              artifact={artifact}
              onClose={() => setArtifact(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}