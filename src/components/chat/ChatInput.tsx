import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "../ui/Button";
import { useChatStore } from "../../stores/chat-store";
import { useChatStream } from "../../hooks/use-chat";

export function ChatInput() {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStreaming = useChatStore((state) => state.isStreaming);
  const { sendMessage } = useChatStream();

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    setInput("");
    await sendMessage(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-sanctuary-border bg-sanctuary-bg p-4">
      <div className="flex items-end gap-3 max-w-3xl mx-auto">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Share what's on your mind..."
            disabled={isStreaming}
            rows={1}
            className="w-full resize-none rounded-xl border border-sanctuary-border bg-sanctuary-card px-4 py-3 pr-12 text-sanctuary-text placeholder:text-sanctuary-muted focus:outline-none focus:ring-2 focus:ring-sanctuary-accent disabled:opacity-50"
          />
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!input.trim() || isStreaming}
          size="icon"
          className="shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-sanctuary-muted text-center mt-2">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
