import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage, DbChatMessage, SafetyResult, SourceReference } from "../types/chat";
import { dbMessageToUi } from "../types/chat";

interface ChatState {
  // Messages keyed by journal_id (null key for global/unscoped chat)
  messagesByEntry: Record<string, ChatMessage[]>;

  // Loading state per entry
  loadingEntries: Set<string>;

  // Load error state per entry
  loadErrors: Map<string, Error>;

  // Actions for managing messages
  loadMessages: (journalId: string) => Promise<void>;
  addMessage: (journalId: string | null, message: Omit<ChatMessage, "id" | "timestamp" | "journalId">) => string;
  updateMessage: (journalId: string | null, id: string, content: string) => void;
  appendToMessage: (journalId: string | null, id: string, chunk: string) => void;
  removeMessage: (journalId: string | null, id: string) => void;
  setMessageStreaming: (journalId: string | null, id: string, isStreaming: boolean) => void;
  setMessageSources: (journalId: string | null, id: string, sources: SourceReference[]) => void;
  clearMessages: (journalId: string) => void;
  getMessages: (journalId: string | null) => ChatMessage[];
  getLoadError: (journalId: string | null) => Error | undefined;

  // Streaming state
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
  streamingEntryId: string | null;
  setStreamingEntryId: (id: string | null) => void;
  currentStreamingMessageId: string | null;
  setCurrentStreamingMessageId: (id: string | null) => void;

  // Safety state
  safetyWarning: SafetyResult | null;
  setSafetyWarning: (warning: SafetyResult | null) => void;
  showSafetyModal: boolean;
  setShowSafetyModal: (show: boolean) => void;

  // Input state (per entry)
  pendingMessageByEntry: Record<string, string>;
  getPendingMessage: (journalId: string | null) => string;
  setPendingMessage: (journalId: string | null, message: string) => void;
}

let messageIdCounter = 0;

const generateMessageId = () => {
  messageIdCounter += 1;
  return `msg-${Date.now()}-${messageIdCounter}`;
};

const getEntryKey = (journalId: string | null): string => journalId ?? "__global__";

export const useChatStore = create<ChatState>((set, get) => ({
  // Messages by entry
  messagesByEntry: {},
  loadingEntries: new Set(),
  loadErrors: new Map(),

  loadMessages: async (journalId: string) => {
    const state = get();
    if (state.loadingEntries.has(journalId)) return;
    if (state.messagesByEntry[journalId]) return; // Already loaded

    set((s) => ({
      loadingEntries: new Set(s.loadingEntries).add(journalId),
    }));

    try {
      const dbMessages = await invoke<DbChatMessage[]>("list_entry_messages", {
        journalId,
      });
      const messages = dbMessages.map(dbMessageToUi);

      set((s) => {
        const newLoadingEntries = new Set(s.loadingEntries);
        newLoadingEntries.delete(journalId);
        const newLoadErrors = new Map(s.loadErrors);
        newLoadErrors.delete(journalId);
        return {
          messagesByEntry: {
            ...s.messagesByEntry,
            [journalId]: messages,
          },
          loadingEntries: newLoadingEntries,
          loadErrors: newLoadErrors,
        };
      });
    } catch (error) {
      console.error("Failed to load messages:", error);
      const err = error instanceof Error ? error : new Error(String(error));
      set((s) => {
        const newLoadingEntries = new Set(s.loadingEntries);
        newLoadingEntries.delete(journalId);
        const newLoadErrors = new Map(s.loadErrors);
        newLoadErrors.set(journalId, err);
        return { loadingEntries: newLoadingEntries, loadErrors: newLoadErrors };
      });
    }
  },

  addMessage: (journalId, message) => {
    const id = generateMessageId();
    const key = getEntryKey(journalId);

    set((state) => ({
      messagesByEntry: {
        ...state.messagesByEntry,
        [key]: [
          ...(state.messagesByEntry[key] || []),
          {
            ...message,
            id,
            journalId,
            timestamp: new Date(),
          },
        ],
      },
    }));
    return id;
  },

  updateMessage: (journalId, id, content) => {
    const key = getEntryKey(journalId);
    set((state) => ({
      messagesByEntry: {
        ...state.messagesByEntry,
        [key]: (state.messagesByEntry[key] || []).map((m) =>
          m.id === id ? { ...m, content } : m
        ),
      },
    }));
  },

  appendToMessage: (journalId, id, chunk) => {
    const key = getEntryKey(journalId);
    set((state) => ({
      messagesByEntry: {
        ...state.messagesByEntry,
        [key]: (state.messagesByEntry[key] || []).map((m) =>
          m.id === id ? { ...m, content: m.content + chunk } : m
        ),
      },
    }));
  },

  removeMessage: (journalId, id) => {
    const key = getEntryKey(journalId);
    set((state) => ({
      messagesByEntry: {
        ...state.messagesByEntry,
        [key]: (state.messagesByEntry[key] || []).filter((m) => m.id !== id),
      },
    }));
  },

  setMessageStreaming: (journalId, id, isStreaming) => {
    const key = getEntryKey(journalId);
    set((state) => ({
      messagesByEntry: {
        ...state.messagesByEntry,
        [key]: (state.messagesByEntry[key] || []).map((m) =>
          m.id === id ? { ...m, isStreaming } : m
        ),
      },
    }));
  },

  setMessageSources: (journalId, id, sources) => {
    const key = getEntryKey(journalId);
    set((state) => ({
      messagesByEntry: {
        ...state.messagesByEntry,
        [key]: (state.messagesByEntry[key] || []).map((m) =>
          m.id === id ? { ...m, sources } : m
        ),
      },
    }));
  },

  clearMessages: (journalId) => {
    const key = getEntryKey(journalId);
    set((state) => {
      const newMessages = { ...state.messagesByEntry };
      delete newMessages[key];
      return { messagesByEntry: newMessages };
    });
  },

  getMessages: (journalId) => {
    const key = getEntryKey(journalId);
    return get().messagesByEntry[key] || [];
  },

  getLoadError: (journalId) => {
    const key = getEntryKey(journalId);
    return get().loadErrors.get(key);
  },

  // Streaming state
  isStreaming: false,
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  streamingEntryId: null,
  setStreamingEntryId: (id) => set({ streamingEntryId: id }),
  currentStreamingMessageId: null,
  setCurrentStreamingMessageId: (id) => set({ currentStreamingMessageId: id }),

  // Safety state
  safetyWarning: null,
  setSafetyWarning: (warning) => set({ safetyWarning: warning }),
  showSafetyModal: false,
  setShowSafetyModal: (show) => set({ showSafetyModal: show }),

  // Input state per entry
  pendingMessageByEntry: {},
  getPendingMessage: (journalId) => {
    const key = getEntryKey(journalId);
    return get().pendingMessageByEntry[key] || "";
  },
  setPendingMessage: (journalId, message) => {
    const key = getEntryKey(journalId);
    set((state) => ({
      pendingMessageByEntry: {
        ...state.pendingMessageByEntry,
        [key]: message,
      },
    }));
  },
}));
