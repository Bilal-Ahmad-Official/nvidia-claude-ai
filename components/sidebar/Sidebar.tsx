"use client";

import { useMemo, useState } from "react";
import { useChatStore } from "@/store/chat-store";
import ConversationItem from "./ConversationItem";
import {
  Code,
  Download,
  Folder,
  Package,
  PanelLeft,
  Plus,
  Search,
  Sliders,
  X,
} from "@/components/ui/icons";

const NAV = [
  { icon: Folder, label: "Projects" },
  { icon: Package, label: "Artifacts" },
  { icon: Code, label: "Code", badge: "Upgrade" },
  { icon: Sliders, label: "Customize" },
];

export default function Sidebar({
  open,
  onClose,
  onCollapse,
}: {
  open: boolean;
  onClose: () => void;
  onCollapse: () => void;
}) {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeId);
  const newConversation = useChatStore((s) => s.newConversation);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const closeIfMobile = () => {
    if (!window.matchMedia("(min-width: 1024px)").matches) onClose();
  };

  const filtered = useMemo(
    () =>
      conversations
        .filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations, query]
  );

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(conversations, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "claude-chats.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-[var(--bg-sidebar)] transition-transform duration-200 lg:static ${
          open ? "translate-x-0" : "-translate-x-full lg:hidden"
        }`}
      >
        {/* Wordmark */}
        <div className="flex items-center justify-between px-4 pb-1 pt-4">
          <span className="font-serif text-xl font-semibold tracking-tight">
            Claude
          </span>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--hover)] lg:hidden"
          >
            <X />
          </button>
        </div>

        {/* Primary nav */}
        <div className="px-3 pt-2">
          <button
            onClick={() => {
              newConversation();
              closeIfMobile();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl bg-[var(--hover)] px-3 py-2.5 text-[15px] font-medium text-[var(--text)] transition hover:bg-[var(--active)]"
          >
            <Plus className="h-4 w-4" />
            New
          </button>

          <nav className="mt-1">
            {NAV.map((n) => (
              <button
                key={n.label}
                title="Coming soon"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
              >
                <n.icon className="h-4 w-4" />
                <span className="flex-1 text-left">{n.label}</span>
                {n.badge && (
                  <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
                    {n.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Chats */}
        <div className="mt-4 flex items-center justify-between px-5 pb-1">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
            Chats and tasks
          </p>
        </div>

        {searchOpen && (
          <div className="px-3 pb-1 pt-1">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-[var(--muted)]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search chats"
                className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
              />
            </div>
          </div>
        )}

        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-2">
          {filtered.length === 0 && (
            <p className="px-2 py-2 text-xs text-[var(--muted)]">No chats yet</p>
          )}
          {filtered.map((c) => (
            <ConversationItem
              key={c.id}
              conv={c}
              active={c.id === activeId}
              onSelect={() => {
                useChatStore.getState().selectConversation(c.id);
                closeIfMobile();
              }}
            />
          ))}
        </nav>

        {/* Bottom bar */}
        <div className="border-t border-[var(--border)] p-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#e89b7b] to-[#c4633f] text-xs font-semibold text-white">
              B
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-[var(--text)]">You</p>
              <p className="truncate text-[11px] text-[var(--muted)]">
                NVIDIA NIM · Free plan
              </p>
            </div>
            <button
              onClick={exportAll}
              title="Export all chats (JSON)"
              className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={() => setSearchOpen((v) => !v)}
              title="Search chats"
              className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              onClick={onCollapse}
              title="Collapse sidebar"
              className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--hover)] hover:text-[var(--text)]"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}