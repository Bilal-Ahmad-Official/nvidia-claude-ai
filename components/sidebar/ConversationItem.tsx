"use client";

import { useState } from "react";
import type { Conversation } from "@/types";
import { useChatStore } from "@/store/chat-store";
import { Pencil, Trash } from "@/components/ui/icons";

export default function ConversationItem({
  conv,
  active,
  onSelect,
}: {
  conv: Conversation;
  active: boolean;
  onSelect: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(conv.title);
  const rename = useChatStore((s) => s.renameConversation);
  const del = useChatStore((s) => s.deleteConversation);

  const commit = () => {
    rename(conv.id, draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        onBlur={commit}
        className="w-full rounded-lg bg-[var(--surface)] px-3 py-2 text-sm outline-none ring-1 ring-[var(--accent)]"
      />
    );
  }

  return (
    <div
      onClick={onSelect}
      className={`group flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
        active
          ? "bg-[var(--hover)] text-[var(--text)]"
          : "text-[var(--muted)] hover:bg-[var(--hover)]/60 hover:text-[var(--text)]"
      }`}
    >
      <span className="shrink-0">
        <svg
          viewBox="0 0 24 24"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <circle cx="12" cy="12" r="8" fill={active ? "currentColor" : "none"} />
        </svg>
      </span>
      <span className="flex-1 truncate">{conv.title}</span>
      <div className="hidden gap-0.5 group-hover:flex">
        <button
          title="Rename"
          onClick={(e) => {
            e.stopPropagation();
            setDraft(conv.title);
            setEditing(true);
          }}
          className="rounded p-1 hover:bg-[var(--active)]"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          title="Delete"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("Delete this chat?")) del(conv.id);
          }}
          className="rounded p-1 hover:bg-[var(--active)] hover:text-red-400"
        >
          <Trash className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}