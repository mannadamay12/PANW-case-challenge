/** Status of Ollama availability */
export interface OllamaStatus {
  is_running: boolean;
  model_available: boolean;
  model_name: string;
  error: string | null;
}

/** Safety check result from the backend */
export interface SafetyResult {
  safe: boolean;
  level: SafetyLevel;
  intervention: string | null;
}

export type SafetyLevel = "safe" | "distress" | "crisis";

/** Chat message in the conversation */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

/** Event payload for streaming chat chunks */
export interface ChatChunkEvent {
  chunk: string;
  done: boolean;
}

/** Event payload for chat errors */
export interface ChatErrorEvent {
  message: string;
}
