import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { PaperPlaneRight, Sparkle, X } from "@phosphor-icons/react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { useUIStore } from "../../stores/ui-store";
import { useChatStore } from "../../stores/chat-store";
import { useEntryMessages, useEntryChatStream, useOllamaStatus } from "../../hooks/use-chat";
import { useEntryEmotions } from "../../hooks/use-ml";
import { useAnimatedPresence } from "../../hooks/use-animated-presence";
import { SafetyModal } from "../chat/SafetyModal";
import { DistressBanner } from "../chat/DistressBanner";
import { EmotionPulse } from "../chat/EmotionPulse";
import { EntryContextHeader } from "../chat/EntryContextHeader";
import { MessageBubble } from "../chat/MessageBubble";
import { getSmartActions } from "../chat/smart-actions";

interface AISidepanelProps {
  journalId: string | null;
  // entryContent is reserved for future use (selection-based actions)
  entryContent?: string;
}

export function AISidepanel({ journalId, entryContent: _entryContent }: AISidepanelProps) {
  const { isAIPanelOpen, setAIPanelOpen } = useUIStore();
  const { shouldRender, isAnimating } = useAnimatedPresence(isAIPanelOpen, 200);
  const { messages, isLoading } = useEntryMessages(journalId);
  const { sendMessage, isStreaming } = useEntryChatStream(journalId);
  const { data: ollamaStatus } = useOllamaStatus();
  const { data: emotions } = useEntryEmotions(journalId);
  const getPendingMessage = useChatStore((s) => s.getPendingMessage);
  const setPendingMessage = useChatStore((s) => s.setPendingMessage);

  // Get emotion-aware quick actions
  const quickActions = getSmartActions(emotions);

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
          <h3 className="font-medium text-sanctuary-text text-sm">MindScribe Companion</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setAIPanelOpen(false)}
          className="h-7 w-7 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Entry Context - header + emotions as one unit */}
      {journalId && (
        <div className="border-b border-sanctuary-border">
          <EntryContextHeader journalId={journalId} />
          <EmotionPulse journalId={journalId} className="pt-0" />
        </div>
      )}

      {/* Quick Actions - emotion-aware */}
      {isReady && (
        <div className="p-2 border-b border-sanctuary-border">
          <div className="flex gap-1.5 flex-wrap">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action.prompt)}
                disabled={isStreaming}
                style={{ cursor: "pointer" }}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-xs rounded-full",
                  "bg-sanctuary-card border border-sanctuary-border",
                  "hover:bg-sanctuary-accent/10 hover:border-sanctuary-accent/30 hover:shadow-sm",
                  "text-sanctuary-muted hover:text-sanctuary-text",
                  "transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <MessageBubble key={message.id} message={message} compact />
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
