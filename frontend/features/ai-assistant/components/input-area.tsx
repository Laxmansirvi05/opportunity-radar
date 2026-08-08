"use client";

import { ArrowUp, SendHorizontal } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

const DRAFT_KEY = "or-assistant-draft";

export function InputArea({
  onSendMessage,
  disabled,
}: {
  onSendMessage: (msg: string) => void;
  disabled?: boolean;
}) {
  const [message, setMessage] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(DRAFT_KEY) ?? "";
    }
    return "";
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const newHeight = Math.min(el.scrollHeight, 120);
    el.style.height = `${newHeight}px`;
    el.style.overflowY = el.scrollHeight > 120 ? "auto" : "hidden";
  }, [message]);

  // Persist draft
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (message) {
        localStorage.setItem(DRAFT_KEY, message);
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || disabled) return;
    onSendMessage(trimmed);
    setMessage("");
    localStorage.removeItem(DRAFT_KEY);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const canSend = !!message.trim() && !disabled;

  return (
    <div className="shrink-0 w-full px-[16px] md:px-[32px] pb-[calc(env(safe-area-inset-bottom))] pt-[8px] mb-[24px]">
      <div className="mx-auto w-full max-w-[820px]">
        <form
          onSubmit={handleSubmit}
          className="relative flex w-full items-center rounded-[32px] border border-outline-variant/20 bg-surface-container-lowest shadow-xl shadow-black/10 transition-all duration-300 ease-out focus-within:ring-4 focus-within:ring-primary/10 focus-within:shadow-2xl"
        >
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              disabled
                ? "AI Assistant is thinking…"
                : "Ask anything about opportunities, resumes, or your career..."
            }
            aria-label="Message input"
            className="chat-scrollbar w-full resize-none border-none bg-transparent py-[20px] pl-[24px] pr-[72px] text-[15px] leading-relaxed text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none disabled:opacity-50"
            rows={1}
          />
          <div className="absolute right-[8px] top-1/2 flex -translate-y-1/2 items-center justify-center">
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send message"
              className={`flex size-[48px] shrink-0 items-center justify-center rounded-full transition-all duration-300 ease-out ${
                canSend
                  ? "cursor-pointer bg-primary text-on-primary shadow-md shadow-primary/30 hover:bg-primary/90 hover:scale-[1.03] hover:shadow-lg active:scale-95"
                  : "cursor-not-allowed bg-surface-container-high/60 text-on-surface-variant/40"
              }`}
            >
              {canSend ? <ArrowUp size={24} strokeWidth={2.5} /> : <SendHorizontal size={22} strokeWidth={2} />}
            </button>
          </div>
        </form>
        <p className="mt-[8px] text-center text-[12px] text-on-surface-variant/55">
          Responses can be imperfect. Verify important information.
        </p>
      </div>
    </div>
  );
}
