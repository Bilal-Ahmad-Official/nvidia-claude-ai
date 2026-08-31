"use client";

import { useCallback, useRef } from "react";
import { useChatStore } from "@/store/chat-store";
import type { Attachment, Message } from "@/types";
import type { ContentPart } from "@/lib/nim-client";

type HistoryContent = string | ContentPart[];
interface HistoryItem {
  role: string;
  content: HistoryContent;
}

function messageToHistory(m: Message): HistoryContent {
  const textFiles = (m.attachments ?? []).filter(
    (a) => a.kind === "text" && a.content
  );
  const images = (m.attachments ?? []).filter(
    (a) => a.kind === "image" && a.dataUrl
  );

  let body = m.content;
  for (const a of textFiles) {
    body += `\n\n---\n**File: ${a.name}**\n\`\`\`\n${a.content}\n\`\`\``;
  }

  if (images.length === 0) return body;

  const parts: ContentPart[] = [];
  parts.push({
    type: "text",
    text: body.trim() || "Please analyze the attached image(s).",
  });
  for (const img of images) {
    parts.push({ type: "image_url", image_url: { url: img.dataUrl! } });
  }
  return parts;
}

export function useChat() {
  const activeConversation = useChatStore((s) =>
    s.conversations.find((c) => c.id === s.activeId)
  );
  const isStreaming = useChatStore((s) => s.isStreaming);
  const abortRef = useRef<AbortController | null>(null);

  const runStream = useCallback(
    async (convId: string, history: HistoryItem[]) => {
      const store = useChatStore.getState();
      store.setStreaming(true);
      abortRef.current = new AbortController();

      try {
        const { model, deepThink } = useChatStore.getState();

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, model, deepThink }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? `Request failed (${res.status})`);
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          useChatStore
            .getState()
            .appendToLastMessage(convId, decoder.decode(value, { stream: true }));
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          useChatStore
            .getState()
            .appendToLastMessage(
              convId,
              `\n\n⚠️ ${err instanceof Error ? err.message : "Something went wrong"}`
            );
        }
      } finally {
        useChatStore.getState().setStreaming(false);
        abortRef.current = null;
      }
    },
    []
  );

  const sendMessage = useCallback(
    async (text: string, attachments: Attachment[] = []) => {
      const trimmed = text.trim();
      if (!trimmed && attachments.length === 0) return;

      const store = useChatStore.getState();
      if (store.isStreaming) return;

      // Reuse the active conversation; only create one if none is active
      let convId = store.activeId;
      if (!convId) {
        store.newConversation();
        convId = useChatStore.getState().activeId;
      }
      if (!convId) return;

      store.addMessage(convId, {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
        attachments: attachments.length ? attachments : undefined,
      });

      store.addMessage(convId, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      });

      const conv = useChatStore
        .getState()
        .conversations.find((c) => c.id === convId);
      const history: HistoryItem[] = (conv?.messages ?? [])
        .filter((m: Message) => m.role !== "assistant" || m.content.trim() !== "")
        .map((m: Message) => ({ role: m.role, content: messageToHistory(m) }));

      await runStream(convId, history);
    },
    [runStream]
  );

  const retry = useCallback(async () => {
    const store = useChatStore.getState();
    const convId = store.activeId;
    if (!convId || store.isStreaming) return;

    const conv = store.conversations.find((c) => c.id === convId);
    if (!conv) return;

    const msgs = [...conv.messages];
    while (msgs.length && msgs[msgs.length - 1].role === "assistant") msgs.pop();
    if (msgs.length === 0) return;

    const history: HistoryItem[] = msgs.map((m) => ({
      role: m.role,
      content: messageToHistory(m),
    }));

    store.setMessages(convId, [
      ...msgs,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      },
    ]);

    await runStream(convId, history);
  }, [runStream]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return {
    messages: activeConversation?.messages ?? [],
    isStreaming,
    sendMessage,
    stop,
    retry,
  };
}