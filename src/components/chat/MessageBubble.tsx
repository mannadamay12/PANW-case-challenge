import { useState } from "react";
import { cn } from "../../lib/utils";
import type { ChatMessage } from "../../types/chat";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
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
          "max-w-[80%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-sanctuary-accent text-white rounded-br-md"
            : "bg-sanctuary-card border border-sanctuary-border text-sanctuary-text rounded-bl-md",
          message.isStreaming && "animate-pulse"
        )}
      >
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {message.content || (message.isStreaming && (
            <span className="text-sanctuary-muted italic">Thinking...</span>
          ))}
        </div>

        {/* Sources section for assistant messages */}
        {!isUser && hasSources && !message.isStreaming && (
          <div className="mt-2 pt-2 border-t border-sanctuary-border/50">
            <button
              onClick={() => setSourcesExpanded(!sourcesExpanded)}
              className="text-xs text-sanctuary-muted hover:text-sanctuary-text transition-colors flex items-center gap-1"
            >
              <span className={cn(
                "transition-transform",
                sourcesExpanded && "rotate-90"
              )}>
                ▶
              </span>
              Sources ({message.sources!.length})
            </button>
            {sourcesExpanded && (
              <ul className="mt-1 space-y-1">
                {message.sources!.map((source) => (
                  <li
                    key={source.entry_id}
                    className="text-xs text-sanctuary-muted pl-3 border-l border-sanctuary-border"
                  >
                    <span className="font-medium">
                      {new Date(source.date).toLocaleDateString()}
                    </span>
                    : {source.snippet}
                  </li>
                ))}
              </ul>
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
