"use client";

import { Sparkles, User, Copy, Check, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useState, useCallback } from "react";
import type { ChatMessage } from "../types";
import { OpportunityCardInline } from "./opportunity-card";

interface ChatBubbleProps {
  message: ChatMessage;
  isLast?: boolean;
  onRegenerate?: () => void;
}

export function ChatBubble({ message, isLast, onRegenerate }: ChatBubbleProps) {
  const isAI = message.role === "ai";
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied in an embedded or non-secure context.
      // Keep the interaction quiet rather than emitting an unhandled error.
    }
  }, [message.content]);

  return (
    <div
      className={`flex w-full mb-[32px] animate-in fade-in slide-in-from-bottom-2 duration-300 ${isAI ? "justify-start" : "justify-end"
        }`}
    >
      <div
        className={`flex w-full gap-[12px] ${isAI
          ? "flex-row"
          : "flex-row-reverse"
          }`}
      >
        {/* Avatar */}
        <div className="flex-shrink-0 mt-[6px]">
          {isAI ? (
            <div className="grid size-[32px] place-items-center rounded-full bg-primary text-on-primary shadow-sm shadow-primary/20">
              <Sparkles size={16} />
            </div>
          ) : (
            <div className="flex size-[32px] items-center justify-center rounded-full bg-surface-container-high">
              <User size={16} className="text-on-surface-variant" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className={`flex flex-col min-w-0 ${isAI ? "max-w-[640px]" : "max-w-[480px]"}`}>
          <div
            className={`px-[20px] py-[16px] text-[15px] leading-relaxed border-none ${isAI
              ? "rounded-[24px] rounded-tl-[12px] bg-surface-container-lowest text-on-surface shadow-md shadow-black/[0.04]"
              : "rounded-[24px] rounded-br-[12px] bg-primary text-on-primary shadow-md shadow-primary/20"
              }`}
          >
            {isAI ? (
              <div className="prose max-w-none text-[15px] leading-relaxed prose-headings:font-bold prose-headings:text-primary prose-headings:mt-6 prose-headings:mb-3 prose-p:text-on-surface prose-p:mb-4 prose-ul:pl-5 prose-ol:pl-5 prose-li:my-3 prose-li:text-on-surface prose-strong:font-semibold prose-strong:text-on-surface prose-code:text-primary prose-code:bg-surface-container prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[13px] prose-pre:bg-surface-container prose-pre:border prose-pre:border-outline-variant/20 prose-blockquote:border-primary/30 prose-a:text-primary">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            ) : (
              <span className="whitespace-pre-wrap break-words">
                {message.content}
              </span>
            )}

            {/* Opportunity Cards */}
            {message.opportunities && message.opportunities.length > 0 && (
              <div className="mt-4 flex flex-col gap-3">
                {message.opportunities.map((opp) => (
                  <OpportunityCardInline key={opp.id} opportunity={opp} />
                ))}
              </div>
            )}
          </div>

          {/* Footer: timestamp + actions */}
          <div
            className={`mt-[6px] flex items-center gap-[12px] px-[4px] ${isAI ? "justify-start" : "justify-end"
              }`}
          >
            <span className="text-[12px] text-on-surface-variant/60">
              {message.time}
            </span>

            {isAI && (
              <div className="flex items-center gap-[12px]">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="rounded-[4px] text-on-surface-variant/50 transition-colors hover:bg-surface-container hover:text-on-surface-variant"
                  title="Copy response"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
                {isLast && onRegenerate && (
                  <button
                    type="button"
                    onClick={onRegenerate}
                    className="rounded-[4px] text-on-surface-variant/50 transition-colors hover:bg-surface-container hover:text-on-surface-variant"
                    title="Regenerate response"
                  >
                    <RefreshCw size={16} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
