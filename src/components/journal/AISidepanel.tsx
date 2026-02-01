import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { PaperPlaneRight, Sparkle, X, Lightbulb, ArrowsOut, ArrowClockwise } from "@phosphor-icons/react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui-store";
import { useChatStore } from "../../stores/chat-store";
import { useEntryMessages, useEntryChatStream, useOllamaStatus } from "../../hooks/use-chat";
import { useAnimatedPresence } from "../../hooks/use-animated-presence";
import { SafetyModal } from "../chat/SafetyModal";
import { DistressBanner } from "../chat/DistressBanner";
import type { ChatMessage } from "../../types/chat";

interface AISidepanelProps {
  journalId: string | null;
  // entryContent is reserved for future use (selection-based actions)
  entryContent?: string;
}

/** Quick action buttons for common AI interactions */
const QUICK_ACTIONS = [
  { label: "Reflect", prompt: "What emotions do you notice in this entry?", icon: Lightbulb },
  { label: "Expand", prompt: "Help me expand on these thoughts", icon: ArrowsOut },
  { label: "Reframe", prompt: "How might I reframe this situation positively?", icon: ArrowClockwise },
];

export function AISidepanel({ journalId, entryContent: _entryContent }: AISidepanelProps) {
  const { isAIPanelOpen, setAIPanelOpen } = useUIStore();
  const { shouldRender, isAnimating } = useAnimatedPresence(isAIPanelOpen, 200);
  const { messages, isLoading } = useEntryMessages(journalId);
  const { sendMessage, isStreaming } = useEntryChatStream(journalId);
  const { data: ollamaStatus } = useOllamaStatus();
  const getPendingMessage = useChatStore((s) => s.getPendingMessage);
  const setPendingMessage = useChatStore((s) => s.setPendingMessage);

  const [input, setInput] = useState(() => getPendingMessage(journalId));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isReady = ollamaStatus?.is_running && ollamaStatus?.model_available;

  // Sync input with pending message store
  useEffect(() => {
    setInput(getPendingMessage(journalId));
  }, [journalId, getPendingMessage]);

  // Save pending message when input changes
  useEffect(() => {
    setPendingMessage(journalId, input);
  }, [input, journalId, setPendingMessage]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
    }
  }, [input]);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || !isReady) return;

    setInput("");
    await sendMessage(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleQuickAction = (prompt: string) => {
    if (isStreaming || !isReady) return;
    sendMessage(prompt);
  };

  if (!shouldRender) return null;

  return (
    <div className={cn(
      "w-80 border-l border-sanctuary-border bg-sanctuary-bg flex flex-col h-full",
      isAnimating ? "animate-slide-in-right" : "animate-slide-out-right"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-sanctuary-border">
        <div className="flex items-center gap-2">
          <Sparkle className="h-4 w-4 text-sanctuary-accent" />
          <h3 className="font-medium text-sanctuary-text text-sm">AI Companion</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setAIPanelOpen(false)}
          className="h-7 w-7"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick Actions */}
      {isReady && (
        <div className="p-2 border-b border-sanctuary-border">
          <div className="flex gap-1.5 flex-wrap">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action.prompt)}
                disabled={isStreaming}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-xs rounded-full",
                  "bg-sanctuary-card border border-sanctuary-border",
                  "hover:bg-sanctuary-accent/10 hover:border-sanctuary-accent/30",
                  "text-sanctuary-muted hover:text-sanctuary-text",
                  "transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <action.icon className="h-3 w-3" />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Distress Banner */}
      <DistressBanner />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {!isReady && (
          <div className="text-center py-8">
            <p className="text-sm text-sanctuary-muted">
              Ollama is not running or model is not available.
            </p>
          </div>
        )}

        {isReady && messages.length === 0 && !isLoading && (
          <div className="text-center py-8">
            <Sparkle className="h-8 w-8 text-sanctuary-muted/50 mx-auto mb-3" />
            <p className="text-sm text-sanctuary-muted">
              Ask me anything about your entry or use a quick action above.
            </p>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-8">
            <p className="text-sm text-sanctuary-muted animate-pulse">
              Loading conversation...
            </p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {isReady && (
        <div className="p-2 border-t border-sanctuary-border">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              disabled={isStreaming}
              rows={1}
              className={cn(
                "flex-1 resize-none rounded-lg border border-sanctuary-border",
                "bg-sanctuary-card px-3 py-2 text-sm text-sanctuary-text",
                "placeholder:text-sanctuary-muted",
                "focus:outline-none focus:ring-1 focus:ring-sanctuary-accent",
                "disabled:opacity-50"
              )}
            />
            <Button
              onClick={handleSubmit}
              disabled={!input.trim() || isStreaming}
              size="icon"
              className="h-9 w-9 shrink-0"
            >
              <PaperPlaneRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Safety Modal */}
      <SafetyModal />
    </div>
  );
}

/** Compact message bubble for the sidepanel */
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full animate-slide-up",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[90%] rounded-xl px-3 py-2",
          isUser
            ? "bg-sanctuary-accent text-white rounded-br-sm"
            : "bg-sanctuary-card border border-sanctuary-border text-sanctuary-text rounded-bl-sm",
          message.isStreaming && "animate-pulse"
        )}
      >
        <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {message.content || (message.isStreaming && (
            <span className="flex items-center gap-1.5 text-sanctuary-muted">
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 bg-sanctuary-muted rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-sanctuary-muted rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-sanctuary-muted rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </span>
              <span className="italic">Thinking...</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
