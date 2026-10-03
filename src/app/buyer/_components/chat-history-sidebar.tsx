"use client";

import { motion } from "motion/react";
import {
  MessageSquarePlus,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarBody,
  useSidebar,
} from "@/components/ui/sidebar";
import type { ChatThread } from "../_lib/chat-threads";

function ThreadRow({
  thread,
  active,
  onSelect,
  onDelete,
}: {
  thread: ChatThread;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const { open } = useSidebar();

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 rounded-xl border px-2 py-2 transition-colors",
        active
          ? "border-foreground/25 bg-background"
          : "border-transparent hover:bg-muted/60",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        title={thread.title}
      >
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg border border-border",
            active ? "bg-foreground text-background" : "bg-muted/50",
          )}
        >
          <MessagesSquare className="size-3.5" />
        </span>
        {open ? (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-w-0 flex-1 truncate text-sm"
          >
            {thread.title}
          </motion.span>
        ) : null}
      </button>
      {open ? (
        <button
          type="button"
          aria-label={`Delete ${thread.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="shrink-0 rounded-md p-1.5 text-foreground/35 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function SidebarChrome({
  threads,
  activeId,
  onNew,
  onSelect,
  onDelete,
  onTogglePin,
  pinnedOpen,
}: {
  threads: ChatThread[];
  activeId: string;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin: () => void;
  pinnedOpen: boolean;
}) {
  const { open, setOpen } = useSidebar();

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        {open ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-w-0 flex-1 font-[family-name:var(--font-syne)] text-sm font-semibold tracking-tight"
          >
            Conversations
          </motion.p>
        ) : (
          <span className="flex-1" />
        )}
        <button
          type="button"
          aria-label={pinnedOpen ? "Collapse sidebar" : "Expand sidebar"}
          onClick={onTogglePin}
          className="hidden size-8 shrink-0 items-center justify-center rounded-lg border border-border text-foreground/55 hover:bg-muted md:flex"
        >
          {pinnedOpen ? (
            <PanelLeftClose className="size-3.5" />
          ) : (
            <PanelLeftOpen className="size-3.5" />
          )}
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          onNew();
          setOpen(false);
        }}
        className={cn(
          "flex items-center gap-2.5 rounded-xl border border-border bg-background px-2 py-2 text-sm font-medium transition-colors hover:bg-muted",
          !open && "justify-center",
        )}
      >
        <MessageSquarePlus className="size-4 shrink-0" />
        {open ? (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            New chat
          </motion.span>
        ) : null}
      </button>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden pr-0.5">
        {threads.map((thread) => (
          <ThreadRow
            key={thread.id}
            thread={thread}
            active={thread.id === activeId}
            onSelect={() => {
              onSelect(thread.id);
              setOpen(false);
            }}
            onDelete={() => onDelete(thread.id)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Collapsible chat history — Aceternity sidebar pattern for Borneo buyer.
 * @see https://21st.dev/@manuarora700/components/sidebar
 */
export function ChatHistorySidebar({
  threads,
  activeId,
  open,
  onOpenChange,
  pinned,
  onPinnedChange,
  onNew,
  onSelect,
  onDelete,
}: {
  threads: ChatThread[];
  activeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, desktop sidebar stays expanded (no hover-collapse). */
  pinned: boolean;
  onPinnedChange: (pinned: boolean) => void;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Sidebar
      open={open}
      setOpen={(v) => {
        const next = typeof v === "function" ? v(open) : v;
        onOpenChange(next);
      }}
      animate={!pinned}
    >
      <SidebarBody className="justify-between gap-4">
        <SidebarChrome
          threads={threads}
          activeId={activeId}
          onNew={onNew}
          onSelect={onSelect}
          onDelete={onDelete}
          pinnedOpen={pinned}
          onTogglePin={() => {
            const next = !pinned;
            onPinnedChange(next);
            onOpenChange(next);
          }}
        />
      </SidebarBody>
    </Sidebar>
  );
}
