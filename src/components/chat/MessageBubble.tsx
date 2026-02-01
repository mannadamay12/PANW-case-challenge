import { cn } from "../../lib/utils";
import type { ChatMessage } from "../../types/chat";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full",
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
