"use client";

import { Bot, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  deleteConversationById,
  fetchConversations,
  fetchMessages,
} from "../services/api";
import type { ChatMessage } from "../types";

interface QuickChat {
  id: string;
  title: string;
  updatedAt: string;
}

/**
 * The robot's quick chats, listed on the Assistant page below the main history.
 *
 * Kept as its own section rather than merged into YOUR CHATS: a quick chat is
 * a throwaway one-question exchange capped at {MAX_QUICK_CONVERSATIONS}, and
 * mixing them into the main list would push real conversations out of view.
 *
 * Reading a quick chat expands it in place instead of loading it into the main
 * composer — the main chat's own conversation stays where it was.
 */
export function QuickAssistantHistory() {
  const [chats, setChats] = useState<QuickChat[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchConversations("quick")
      .then((rows) => {
        if (cancelled) return;
        setChats(rows.map((row) => ({ id: row.id, title: row.title, updatedAt: row.updated_at })));
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(
    async (id: string) => {
      if (expandedId === id) {
        setExpandedId(null);
        setMessages([]);
        return;
      }
      setExpandedId(id);
      setMessages([]);
      try {
        setMessages(await fetchMessages(id));
      } catch {
        /* the expanded panel simply stays empty */
      }
    },
    [expandedId]
  );

  const remove = useCallback(
    async (id: string) => {
      const ok = await deleteConversationById(id);
      if (!ok) return;
      setChats((prev) => prev.filter((chat) => chat.id !== id));
      if (expandedId === id) {
        setExpandedId(null);
        setMessages([]);
      }
    },
    [expandedId]
  );

  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-[8px] flex items-center gap-[6px]">
        <Bot size={13} className="text-on-surface-variant/60" />
        <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-on-surface-variant/60">
          QUICK ASSISTANT HISTORY
        </p>
      </div>

      {isLoading ? (
        <p className="px-[4px] text-[12px] text-on-surface-variant/70">Loading…</p>
      ) : chats.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant/40 p-4 text-center">
          <p className="text-[12px] text-on-surface-variant">
            Double-tap the robot anywhere in the app for a quick answer.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-[4px]">
          {chats.map((chat) => (
            <div key={chat.id} className="group rounded-[12px] hover:bg-surface-container/60">
              <div className="flex items-center gap-[4px]">
                <button
                  type="button"
                  onClick={() => toggle(chat.id)}
                  aria-expanded={expandedId === chat.id}
                  className="min-w-0 flex-1 cursor-pointer px-[12px] py-[8px] text-left"
                >
                  <span className="block truncate text-[13px] font-medium text-on-surface">
                    {chat.title || "Untitled chat"}
                  </span>
                  <span className="block text-[11px] text-on-surface-variant/70">
                    {new Date(chat.updatedAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void remove(chat.id)}
                  aria-label={`Delete ${chat.title || "quick chat"}`}
                  title="Delete quick chat"
                  className="mr-[8px] grid size-[26px] shrink-0 cursor-pointer place-items-center rounded-lg text-on-surface-variant/60 opacity-0 transition-opacity hover:bg-error-container hover:text-on-error-container group-hover:opacity-100 focus:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              {expandedId === chat.id && (
                <div className="flex flex-col gap-[6px] px-[12px] pb-[10px]">
                  {messages.length === 0 ? (
                    <p className="text-[12px] text-on-surface-variant/70">Loading messages…</p>
                  ) : (
                    messages.map((message) => (
                      <p
                        key={message.id}
                        className={`whitespace-pre-wrap break-words rounded-[10px] px-[8px] py-[6px] text-[12px] ${
                          message.role === "user"
                            ? "bg-primary/10 text-on-surface"
                            : "bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        {message.content}
                      </p>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
