import { Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { SafetyModal } from "./SafetyModal";
import { DistressBanner } from "./DistressBanner";
import { OllamaSetupBanner, OllamaStatusIndicator } from "./OllamaStatus";
import { useChatStore } from "../../stores/chat-store";
import { useOllamaStatus } from "../../hooks/use-chat";

export function ChatView() {
  const clearMessages = useChatStore((state) => state.clearMessages);
  const messageCount = useChatStore((state) => state.messages.length);
  const { data: status } = useOllamaStatus();

  const isReady = status?.is_running && status?.model_available;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-sanctuary-border">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-sanctuary-text">Chat</h2>
          <OllamaStatusIndicator />
        </div>
        {messageCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearMessages}
            className="text-sanctuary-muted hover:text-red-600"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Banners */}
      <OllamaSetupBanner />
      <DistressBanner />

      {/* Messages */}
      <MessageList />

      {/* Input */}
      {isReady ? (
        <ChatInput />
      ) : (
        <div className="border-t border-sanctuary-border bg-sanctuary-bg p-4">
          <div className="text-center text-sanctuary-muted text-sm">
            Set up Ollama to start chatting
          </div>
        </div>
      )}

      {/* Safety Modal */}
      <SafetyModal />
    </div>
  );
}
