import { useState } from "react";
import { CaretRight } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { SourceCardList } from "./SourceCard";
import type { ChatMessage } from "../../types/chat";

interface MessageBubbleProps {
  message: ChatMessage;
  compact?: boolean;
}

export function MessageBubble({ message, compact = false }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const hasSources = message.sources && message.sources.length > 0;

  return (
    <div
      className={cn(
        "flex w-full animate-slide-up",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "rounded-2xl",
          compact ? "max-w-[90%] px-3 py-2" : "max-w-[80%] px-4 py-3",
          isUser
            ? "bg-sanctuary-accent text-white rounded-br-md"
            : "bg-sanctuary-card border border-sanctuary-border text-sanctuary-text rounded-bl-md",
          message.isStreaming && "animate-pulse"
        )}
      >
        <div className={cn(
          "whitespace-pre-wrap break-words leading-relaxed",
          compact ? "text-sm" : "text-sm"
        )}>
          {message.content || (message.isStreaming && (
            <span className="flex items-center gap-1.5 text-sanctuary-muted">
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
              <span className="italic">Thinking...</span>
            </span>
          ))}
        </div>

        {/* Sources section for assistant messages */}
        {!isUser && hasSources && !message.isStreaming && (
          <div className="mt-2 pt-2 border-t border-sanctuary-border/50">
            <button
              onClick={() => setSourcesExpanded(!sourcesExpanded)}
              className="text-xs text-sanctuary-muted hover:text-sanctuary-text transition-colors flex items-center gap-1 cursor-pointer"
            >
              <CaretRight
                className={cn(
                  "h-3 w-3 transition-transform duration-150",
                  sourcesExpanded && "rotate-90"
                )}
              />
              <span>From your journal ({message.sources!.length})</span>
            </button>
            {sourcesExpanded && (
              <div className="mt-2">
                <SourceCardList
                  sources={message.sources!}
                  compact={compact}
                  maxVisible={3}
                />
              </div>
            )}
          </div>
        )}

        <div
          className={cn(
            "text-xs mt-1 opacity-70",
            isUser ? "text-white/70" : "text-sanctuary-muted"
          )}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
    </div>
  );
}
