"use client";

import React, { useEffect, useRef, useState } from "react";
import { Menu, MessageSquarePlus, Sparkles } from "lucide-react";
import { ChatBubble } from "./chat-bubble";
import { InputArea } from "./input-area";
import { SuggestionChip } from "./suggestion-chip";
import { RightPanel } from "./right-panel";
import { useActiveConversation, useChatStore } from "../store/chat-store";
import { SUGGESTION_CHIPS } from "../types";

interface AssistantViewProps {
  userName?: string;
}

export function AssistantView({ userName = "there" }: AssistantViewProps) {
  const activeConversation = useActiveConversation();
  const { sendMessage, regenerateLastResponse, startNewChat, isLoading, isHydrated, hydrate } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [activeConversation.id, activeConversation.messages, isLoading]);

  const hasMessages = activeConversation.messages.length > 0;

  return (
    <div className="flex h-full w-full overflow-hidden bg-surface">
        {/* MAIN CHAT COLUMN */}
        <main className="flex flex-1 flex-col min-h-0 min-w-0">
          {/* Header */}
          <header className="z-10 flex h-[64px] shrink-0 items-center bg-surface/80 backdrop-blur-md shadow-sm shadow-black/[0.03] px-[16px] md:px-[22px]">
            <div className="flex w-full items-center justify-between">
              <div className="flex min-w-0 items-center gap-[12px]">
                <span className="grid size-[36px] shrink-0 place-items-center rounded-[12px] bg-primary text-on-primary shadow-sm shadow-primary/20">
                  <Sparkles size={18} />
                </span>
                <div className="flex min-w-0 flex-col justify-center">
                  <h1 className="truncate text-[15px] font-semibold leading-snug tracking-tight text-on-surface">AI Assistant</h1>
                  <p className="hidden text-[12px] leading-snug text-on-surface-variant sm:block">Learn, prepare, and discover opportunities in one place.</p>
                </div>
              </div>
              <div className="flex items-center gap-[16px]">
                <button
                  type="button"
                  onClick={() => void startNewChat()}
                  disabled={isLoading}
                  className="hidden h-[36px] items-center gap-[8px] rounded-[8px] border border-outline-variant/50 bg-surface px-[16px] text-[13px] font-semibold text-on-surface shadow-sm transition-all duration-200 hover:bg-surface-container hover:shadow disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex"
                >
                  <MessageSquarePlus size={16} />
                  New chat
                </button>
                <button
                  type="button"
                  onClick={() => setMobilePanelOpen(true)}
                  className="grid size-[36px] place-items-center rounded-[8px] border border-outline-variant/50 text-on-surface transition-colors hover:bg-surface-container xl:hidden"
                  aria-label="Open conversations and quick prompts"
                >
                  <Menu size={18} />
                </button>
              </div>
            </div>
          </header>

          {/* Scrollable message area */}
          <div className="chat-scrollbar flex-1 overflow-y-auto px-[16px] md:px-[32px] pt-[16px] md:pt-[24px]" ref={messagesEndRef}>
            {!isHydrated ? (
              <div className="flex h-full items-center justify-center" role="status">
                <div className="flex items-center gap-[12px] text-sm text-on-surface-variant">
                  <div className="size-[20px] animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  Loading conversations…
                </div>
              </div>
            ) : !hasMessages ? (
              <div className="mx-auto flex w-full max-w-[860px] animate-in flex-col items-center fade-in pb-[16px] pt-[2vh] text-center duration-700 ease-out">
                <div className="assistant-hero grid size-[52px] place-items-center rounded-[16px] bg-primary text-on-primary shadow-[0_12px_26px_-10px_var(--color-primary)] transition-transform duration-500 ease-note">
                  <Sparkles size={28} strokeWidth={2.5} />
                </div>
                <h2 className="mt-[12px] text-[1.9rem] font-bold leading-tight tracking-tight text-on-surface md:text-[2.15rem]">
                  Hi, {userName} <span aria-hidden="true" className="inline-block origin-[70%_70%] hover:animate-wave cursor-default transition-transform hover:scale-110 duration-300">👋</span>
                </h2>
                <p className="mt-[8px] max-w-[520px] text-[14px] leading-relaxed text-on-surface-variant/80">
                  Ask a learning question, practice interviews, or discover verified opportunities on Opportunity Radar.
                </p>
                <div className="mt-[20px] grid w-full grid-cols-1 gap-[10px] sm:grid-cols-2">
                  {SUGGESTION_CHIPS.map((chip) => (
                    <SuggestionChip key={chip} label={chip} onClick={() => void sendMessage(chip)} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="mx-auto flex w-full max-w-[860px] flex-col">
                {activeConversation.messages.map((message, index) => (
                  <ChatBubble
                    key={message.id}
                    message={message}
                    isLast={message.role === "ai" && index === activeConversation.messages.length - 1}
                    onRegenerate={regenerateLastResponse}
                  />
                ))}
                {isLoading && (
                  <div className="mb-[24px] flex w-full justify-start" aria-live="polite" aria-label="Assistant is thinking">
                    <div className="flex items-start gap-[8px]">
                      <span className="grid size-[32px] place-items-center rounded-full bg-primary-container text-on-primary-container"><Sparkles size={16} /></span>
                      <div className="flex h-[40px] items-center gap-[6px] rounded-[16px] rounded-tl-[4px] border border-outline-variant/25 bg-surface-container-lowest px-[16px] shadow-sm">
                        {[0, 150, 300].map((delay) => <span key={delay} className="size-[6px] animate-bounce rounded-full bg-primary/65" style={{ animationDelay: `${delay}ms` }} />)}
                      </div>
                    </div>
                  </div>
                )}
                <div className="h-px" />
              </div>
            )}
          </div>

          {/* Input bar — inside main column, same max-w as messages */}
          <InputArea onSendMessage={sendMessage} disabled={isLoading} />
        </main>

        {/* RIGHT SIDEBAR */}
        <div className="hidden xl:block shrink-0 w-[30%] max-w-[320px] overflow-hidden">
          <RightPanel mobileOpen={mobilePanelOpen} onMobileClose={() => setMobilePanelOpen(false)} />
        </div>

        {/* Mobile drawer for RightPanel */}
        <div className="xl:hidden">
          <RightPanel mobileOpen={mobilePanelOpen} onMobileClose={() => setMobilePanelOpen(false)} />
        </div>
    </div>
  );
}
