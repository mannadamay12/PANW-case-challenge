import { useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  OllamaStatus,
  SafetyResult,
  ChatChunkEvent,
  ChatErrorEvent,
  ChatDoneEvent,
} from "../types/chat";
import { useChatStore } from "../stores/chat-store";

// Query key factory for chat operations
export const chatKeys = {
  all: ["chat"] as const,
  status: () => [...chatKeys.all, "status"] as const,
  safety: (text: string) => [...chatKeys.all, "safety", text] as const,
  messages: (journalId: string) => [...chatKeys.all, "messages", journalId] as const,
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

/** Hook to load and manage messages for a specific journal entry */
export function useEntryMessages(journalId: string | null) {
  const loadMessages = useChatStore((s) => s.loadMessages);
  const getMessages = useChatStore((s) => s.getMessages);
  const getLoadError = useChatStore((s) => s.getLoadError);
  const loadingEntries = useChatStore((s) => s.loadingEntries);

  useEffect(() => {
    if (journalId) {
      loadMessages(journalId);
    }
  }, [journalId, loadMessages]);

  const messages = getMessages(journalId);
  const isLoading = journalId ? loadingEntries.has(journalId) : false;
  const loadError = getLoadError(journalId);

  return { messages, isLoading, loadError };
}

/** Hook to manage chat streaming scoped to a journal entry */
export function useEntryChatStream(journalId: string | null) {
  const {
    addMessage,
    appendToMessage,
    removeMessage,
    setMessageStreaming,
    setMessageSources,
    setIsStreaming,
    setStreamingEntryId,
    setCurrentStreamingMessageId,
    setSafetyWarning,
    setShowSafetyModal,
    streamingEntryId,
    isStreaming,
  } = useChatStore();

  // Set up event listeners for this entry's streaming
  useEffect(() => {
    let isMounted = true;
    const unlisteners: UnlistenFn[] = [];

    const setupListeners = async () => {
      // Listen for chat chunks
      const unlistenChunk = await listen<ChatChunkEvent>(
        "chat-chunk",
        (event) => {
          if (!isMounted) return;
          const { chunk } = event.payload;
          const state = useChatStore.getState();
          const currentId = state.currentStreamingMessageId;
          const entryId = state.streamingEntryId;
          if (currentId && chunk) {
            appendToMessage(entryId, currentId, chunk);
          }
        }
      );
      if (isMounted) unlisteners.push(unlistenChunk);
      else unlistenChunk();

      // Listen for chat completion with sources
      const unlistenDone = await listen<ChatDoneEvent>("chat-done", (event) => {
        if (!isMounted) return;
        const state = useChatStore.getState();
        const currentId = state.currentStreamingMessageId;
        const entryId = state.streamingEntryId;
        if (currentId) {
          setMessageStreaming(entryId, currentId, false);
          // Set sources from the event payload
          if (event.payload?.sources && event.payload.sources.length > 0) {
            setMessageSources(entryId, currentId, event.payload.sources);
          }
        }
        setIsStreaming(false);
        setStreamingEntryId(null);
        setCurrentStreamingMessageId(null);
      });
      if (isMounted) unlisteners.push(unlistenDone);
      else unlistenDone();

      // Listen for chat errors
      const unlistenError = await listen<ChatErrorEvent>(
        "chat-error",
        (event) => {
          if (!isMounted) return;
          console.error("Chat error:", event.payload.message);
          const state = useChatStore.getState();
          const currentId = state.currentStreamingMessageId;
          const entryId = state.streamingEntryId;
          if (currentId) {
            // Remove the incomplete assistant message instead of appending error
            removeMessage(entryId, currentId);
          }
          setIsStreaming(false);
          setStreamingEntryId(null);
          setCurrentStreamingMessageId(null);
        }
      );
      if (isMounted) unlisteners.push(unlistenError);
      else unlistenError();
    };

    setupListeners();

    return () => {
      isMounted = false;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [
    appendToMessage,
    removeMessage,
    setMessageStreaming,
    setMessageSources,
    setIsStreaming,
    setStreamingEntryId,
    setCurrentStreamingMessageId,
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

      // Persist user message if we have a journal ID
      if (journalId) {
        try {
          await invoke("create_chat_message", {
            journalId,
            role: "user",
            content: message,
            metadata: null,
          });
        } catch (error) {
          console.error("Failed to persist user message:", error);
        }
      }

      // Add user message to local state
      addMessage(journalId, { role: "user", content: message });

      // Create placeholder for assistant response
      const assistantId = addMessage(journalId, {
        role: "assistant",
        content: "",
        isStreaming: true,
      });

      setIsStreaming(true);
      setStreamingEntryId(journalId);
      setCurrentStreamingMessageId(assistantId);

      // Start streaming (backend will persist assistant response on completion)
      try {
        await invoke("chat_stream", {
          message,
          journalId: journalId ?? undefined,
          contextLimit: contextLimit ?? 5,
        });
      } catch (error) {
        console.error("Failed to start chat stream:", error);
        // Remove incomplete message instead of appending error text
        removeMessage(journalId, assistantId);
        setIsStreaming(false);
        setStreamingEntryId(null);
        setCurrentStreamingMessageId(null);
      }
    },
    [
      journalId,
      addMessage,
      removeMessage,
      setIsStreaming,
      setStreamingEntryId,
      setCurrentStreamingMessageId,
      setSafetyWarning,
      setShowSafetyModal,
    ]
  );

  return {
    sendMessage,
    isStreaming: isStreaming && streamingEntryId === journalId,
    isStreamingAny: isStreaming,
  };
}

/** Legacy hook for global chat (no journal scope) - for backward compatibility */
export function useChatStream() {
  return useEntryChatStream(null);
}
