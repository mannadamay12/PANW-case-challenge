import { create } from "zustand";
import type { ChatMessage, SafetyResult } from "../types/chat";

interface ChatState {
  // Messages
  messages: ChatMessage[];
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => string;
  updateMessage: (id: string, content: string) => void;
  appendToMessage: (id: string, chunk: string) => void;
  setMessageStreaming: (id: string, isStreaming: boolean) => void;
  clearMessages: () => void;

  // Streaming state
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
  currentStreamingId: string | null;
  setCurrentStreamingId: (id: string | null) => void;

  // Safety state
  safetyWarning: SafetyResult | null;
  setSafetyWarning: (warning: SafetyResult | null) => void;
  showSafetyModal: boolean;
  setShowSafetyModal: (show: boolean) => void;

  // Input state
  pendingMessage: string;
  setPendingMessage: (message: string) => void;
}

let messageIdCounter = 0;

const generateMessageId = () => {
  messageIdCounter += 1;
  return `msg-${Date.now()}-${messageIdCounter}`;
};

export const useChatStore = create<ChatState>((set) => ({
  // Messages
  messages: [],
  addMessage: (message) => {
    const id = generateMessageId();
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          id,
          timestamp: new Date(),
        },
      ],
    }));
    return id;
  },
  updateMessage: (id, content) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content } : m
      ),
    })),
  appendToMessage: (id, chunk) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + chunk } : m
      ),
    })),
  setMessageStreaming: (id, isStreaming) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, isStreaming } : m
      ),
    })),
  clearMessages: () => set({ messages: [] }),

  // Streaming state
  isStreaming: false,
  setIsStreaming: (streaming) => set({ isStreaming: streaming }),
  currentStreamingId: null,
  setCurrentStreamingId: (id) => set({ currentStreamingId: id }),

  // Safety state
  safetyWarning: null,
  setSafetyWarning: (warning) => set({ safetyWarning: warning }),
  showSafetyModal: false,
  setShowSafetyModal: (show) => set({ showSafetyModal: show }),

  // Input state
  pendingMessage: "",
  setPendingMessage: (message) => set({ pendingMessage: message }),
}));
