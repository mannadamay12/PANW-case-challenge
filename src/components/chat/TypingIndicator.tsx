import { useChatStore } from "../../stores/chat-store";

export function TypingIndicator() {
  const isStreaming = useChatStore((state) => state.isStreaming);

  if (!isStreaming) return null;

  return (
    <div className="flex items-center gap-2 text-sanctuary-muted text-sm px-4 py-2">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-sanctuary-accent rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-2 h-2 bg-sanctuary-accent rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-2 h-2 bg-sanctuary-accent rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <span>MindScribe is thinking...</span>
    </div>
  );
}
