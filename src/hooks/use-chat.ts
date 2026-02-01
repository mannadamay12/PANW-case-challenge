import { useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  OllamaStatus,
  SafetyResult,
  ChatChunkEvent,
  ChatErrorEvent,
} from "../types/chat";
import { useChatStore } from "../stores/chat-store";

// Query key factory for chat operations
export const chatKeys = {
  all: ["chat"] as const,
  status: () => [...chatKeys.all, "status"] as const,
  safety: (text: string) => [...chatKeys.all, "safety", text] as const,
};

/** Check if Ollama is running and model is available */
export function useOllamaStatus() {
  return useQuery({
    queryKey: chatKeys.status(),
    queryFn: async () => invoke<OllamaStatus>("check_ollama_status"),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // Refetch every minute
  });
}

/** Check message safety before sending */
export function useCheckSafety() {
  return useMutation({
    mutationFn: async (text: string) =>
      invoke<SafetyResult>("check_message_safety", { text }),
  });
}

/** Hook to manage chat streaming with Tauri events */
export function useChatStream() {
  const {
    addMessage,
    appendToMessage,
    setMessageStreaming,
    setIsStreaming,
    setCurrentStreamingId,
    setSafetyWarning,
    setShowSafetyModal,
  } = useChatStore();

  // Set up event listeners
  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    const setupListeners = async () => {
      // Listen for chat chunks
      const unlistenChunk = await listen<ChatChunkEvent>(
        "chat-chunk",
        (event) => {
          const { chunk } = event.payload;
          const currentId = useChatStore.getState().currentStreamingId;
          if (currentId && chunk) {
            appendToMessage(currentId, chunk);
          }
        }
      );
      unlisteners.push(unlistenChunk);

      // Listen for chat completion
      const unlistenDone = await listen("chat-done", () => {
        const currentId = useChatStore.getState().currentStreamingId;
        if (currentId) {
          setMessageStreaming(currentId, false);
        }
        setIsStreaming(false);
        setCurrentStreamingId(null);
      });
      unlisteners.push(unlistenDone);

      // Listen for chat errors
      const unlistenError = await listen<ChatErrorEvent>(
        "chat-error",
        (event) => {
          console.error("Chat error:", event.payload.message);
          const currentId = useChatStore.getState().currentStreamingId;
          if (currentId) {
            appendToMessage(
              currentId,
              `\n\n*Error: ${event.payload.message}*`
            );
            setMessageStreaming(currentId, false);
          }
          setIsStreaming(false);
          setCurrentStreamingId(null);
        }
      );
      unlisteners.push(unlistenError);
    };

    setupListeners();

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [
    appendToMessage,
    setMessageStreaming,
    setIsStreaming,
    setCurrentStreamingId,
  ]);

  const sendMessage = useCallback(
    async (message: string, contextLimit?: number) => {
      // Check safety first
      const safetyResult = await invoke<SafetyResult>("check_message_safety", {
        text: message,
      });

      if (!safetyResult.safe) {
        setSafetyWarning(safetyResult);
        setShowSafetyModal(true);
        return;
      }

      // Show distress warning but allow continuing
      if (safetyResult.level === "distress") {
        setSafetyWarning(safetyResult);
      }

      // Add user message
      addMessage({ role: "user", content: message });

      // Create placeholder for assistant response
      const assistantId = addMessage({
        role: "assistant",
        content: "",
        isStreaming: true,
      });

      setIsStreaming(true);
      setCurrentStreamingId(assistantId);

      // Start streaming
      try {
        await invoke("chat_stream", {
          message,
          contextLimit: contextLimit ?? 5,
        });
      } catch (error) {
        console.error("Failed to start chat stream:", error);
        appendToMessage(assistantId, `*Error: ${error}*`);
        setMessageStreaming(assistantId, false);
        setIsStreaming(false);
        setCurrentStreamingId(null);
      }
    },
    [
      addMessage,
      appendToMessage,
      setMessageStreaming,
      setIsStreaming,
      setCurrentStreamingId,
      setSafetyWarning,
      setShowSafetyModal,
    ]
  );

  return { sendMessage };
}
