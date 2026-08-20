"use client";

import { BookOpen, ChevronRight, Sparkles, Trash2, X } from "lucide-react";
import { useChatStore } from "../store/chat-store";
import { QUICK_PROMPTS } from "../types";
import { QuickAssistantHistory } from "./quick-assistant-history";

interface RightPanelProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function RightPanel({ mobileOpen = false, onMobileClose }: RightPanelProps) {
  const { conversations, activeId, isLoading, setActiveId, deleteChat } =
    useChatStore();

  const formatConvoTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const handleQuickPrompt = async (label: string) => {
    if (useChatStore.getState().isLoading) return;
    await useChatStore.getState().startNewChat();
    await useChatStore.getState().sendMessage(label);
    onMobileClose?.();
  };

  const handleSelectConversation = async (id: string) => {
    await setActiveId(id);
    onMobileClose?.();
  };

  const content = (
    <div className="flex h-full flex-col gap-[16px] p-[20px]">
      <div className="flex min-h-0 flex-col">
        <div className="mb-[8px] flex items-center justify-between">
          <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-on-surface-variant/60">
            YOUR CHATS
          </p>
        </div>

        <div className="flex flex-col gap-[4px]">
          {conversations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-variant/40 p-6 text-center">
              <p className="text-[13px] font-medium text-on-surface">No chats yet</p>
              <p className="mt-2 text-[12px] leading-relaxed text-on-surface-variant">
                Start a conversation when you’re ready.
              </p>
            </div>
          ) : (
            [...conversations]
              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
              .slice(0, 6)
              .map((conversation) => {
                const isActive = conversation.id === activeId;
                return (
                  <div
                    key={conversation.id}
                    className={`group relative flex h-[48px] min-w-0 items-center justify-between gap-[12px] rounded-[12px] px-[12px] py-[8px] transition-all duration-200 ease-out ${isActive
                      ? "bg-primary-container/20 text-primary shadow-sm"
                      : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface hover:shadow-sm"
                      }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectConversation(conversation.id)}
                      className="flex min-w-0 flex-1 flex-col items-start text-left"
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className={`truncate w-full text-[13px] leading-snug ${isActive ? "font-semibold" : "font-medium"}`}>
                        {conversation.title}
                      </span>
                      <span className={`mt-[4px] block text-[12px] ${isActive ? "text-primary/70 font-medium" : "text-on-surface-variant/60"}`}>
                        {formatConvoTime(conversation.updatedAt)}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteChat(conversation.id);
                      }}
                      disabled={isLoading}
                      aria-label={`Delete ${conversation.title}`}
                      title="Delete conversation"
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-on-surface-variant/40 transition-colors duration-200 hover:bg-error-container hover:text-on-error-container disabled:cursor-not-allowed disabled:opacity-30 xl:opacity-0 xl:group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
          )}

          {conversations.length > 6 && (
            <button
              type="button"
              className="mt-[8px] text-[12px] font-medium text-primary/70 hover:text-primary transition-colors text-left px-[16px]"
            >
              View all chats →
            </button>
          )}
        </div>
      </div>

      <QuickAssistantHistory />

      <div className="flex min-h-0 flex-col rounded-[16px] bg-surface-container-low/50 p-[12px]">
        <div className="mb-[8px] flex items-center gap-[8px]">
          <span className="grid size-[28px] shrink-0 place-items-center rounded-[8px] bg-primary-container/20 text-primary">
            <Sparkles size={14} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-tight text-on-surface">Quick prompts</p>
            <p className="mt-[2px] truncate text-[11px] text-on-surface-variant">Build your technical foundation</p>
          </div>
        </div>

        <div className="flex flex-col gap-[4px]">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              type="button"
              key={prompt.label}
              onClick={() => void handleQuickPrompt(prompt.label)}
              disabled={isLoading}
              className="group flex h-[44px] w-full items-center gap-[8px] rounded-[12px] px-[8px] py-[8px] text-left text-on-surface-variant transition-all duration-200 ease-out hover:bg-surface-container hover:text-on-surface hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="grid size-[28px] shrink-0 place-items-center rounded-[8px] bg-surface-container-high/50 text-on-surface-variant/70 transition-colors duration-200 group-hover:bg-primary-container/20 group-hover:text-primary">
                <BookOpen size={16} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium leading-normal">{prompt.label}</span>
              <ChevronRight size={14} className="shrink-0 text-on-surface-variant/30 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary/70" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden h-full w-full shrink-0 flex-col overflow-hidden bg-surface-container-lowest xl:flex">
        {content}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 xl:hidden" role="dialog" aria-modal="true" aria-label="Assistant conversations">
          <button
            type="button"
            aria-label="Close conversations"
            className="absolute inset-0 bg-on-surface/35 backdrop-blur-[1px]"
            onClick={onMobileClose}
          />
          <aside className="absolute inset-y-0 right-0 flex w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden bg-surface-container-lowest shadow-2xl">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-outline-variant/25 px-4">
              <span className="text-sm font-semibold text-on-surface">Assistant menu</span>
              <button type="button" onClick={onMobileClose} className="grid size-8 place-items-center rounded-lg text-on-surface-variant hover:bg-surface-container" aria-label="Close conversations">
                <X size={18} />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{content}</div>
          </aside>
        </div>
      )}
    </>
  );
}
