import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Conversation, Message } from "@/types";
import { NIM_MODEL } from "@/lib/constants";

export interface Artifact {
  title: string;
  lang: string;
  code: string;
}

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  isStreaming: boolean;
  model: string;
  deepThink: boolean;
  artifact: Artifact | null;
  newConversation: () => void;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  addMessage: (convId: string, m: Message) => void;
  appendToLastMessage: (convId: string, token: string) => void;
  setMessages: (convId: string, messages: Message[]) => void;
  setStreaming: (v: boolean) => void;
  setModel: (m: string) => void;
  setDeepThink: (v: boolean) => void;
  setArtifact: (a: Artifact | null) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,
      isStreaming: false,
      model: NIM_MODEL,
      deepThink: false,
      artifact: null,

      newConversation: () => {
        const { conversations, activeId } = get();
        const active = conversations.find((c) => c.id === activeId);
        if (active && active.messages.length === 0) return;
        const conv: Conversation = {
          id: crypto.randomUUID(),
          title: "New chat",
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set({ conversations: [conv, ...conversations], activeId: conv.id });
      },

      selectConversation: (id) => set({ activeId: id }),

      deleteConversation: (id) => {
        const remaining = get().conversations.filter((c) => c.id !== id);
        set({
          conversations: remaining,
          activeId:
            get().activeId === id ? (remaining[0]?.id ?? null) : get().activeId,
        });
      },

      renameConversation: (id, title) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, title: title.trim() || "New chat" } : c
          ),
        })),

      addMessage: (convId, m) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: [...c.messages, m],
                  updatedAt: Date.now(),
                  title:
                    c.title === "New chat" && m.role === "user"
                      ? m.content.slice(0, 50).trim() || "New chat"
                      : c.title,
                }
              : c
          ),
        })),

      appendToLastMessage: (convId, token) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== convId) return c;
            const messages = [...c.messages];
            const last = messages[messages.length - 1];
            if (last) {
              messages[messages.length - 1] = {
                ...last,
                content: last.content + token,
              };
            }
            return { ...c, messages };
          }),
        })),

      setMessages: (convId, messages) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId ? { ...c, messages, updatedAt: Date.now() } : c
          ),
        })),

      setStreaming: (v) => set({ isStreaming: v }),
      setModel: (m) => set({ model: m }),
      setDeepThink: (v) => set({ deepThink: v }),
      setArtifact: (a) => set({ artifact: a }),
    }),
    {
      name: "nvidia-claude-chat",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        ...state,
        isStreaming: false,
        artifact: null,
        conversations: state.conversations.map((c) => ({
          ...c,
          messages: c.messages.map((m) => ({
            ...m,
            attachments: m.attachments?.map((a) => ({
              name: a.name,
              size: a.size,
              kind: a.kind,
            })),
          })),
        })),
      }),
    }
  )
);