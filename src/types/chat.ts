/** Status of Ollama availability */
export interface OllamaStatus {
  is_running: boolean;
  model_available: boolean;
  model_name: string;
  error: string | null;
}

/** Source reference for RAG attribution */
export interface SourceReference {
  entry_id: string;
  date: string;
  snippet: string;
  score: number;
}

/** Safety check result from the backend */
export interface SafetyResult {
  safe: boolean;
  level: SafetyLevel;
  intervention: string | null;
}

export type SafetyLevel = "safe" | "distress" | "crisis";

/** Chat message stored in the database (from backend) */
export interface DbChatMessage {
  id: string;
  journal_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  metadata: string | null;
}

/** Chat message in the UI (with local state) */
export interface ChatMessage {
  id: string;
  journalId: string | null;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  sources?: SourceReference[];
}

/** Event payload for chat done with sources */
export interface ChatDoneEvent {
  sources?: SourceReference[];
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

/** Convert a database chat message to UI format */
export function dbMessageToUi(msg: DbChatMessage): ChatMessage {
  // Parse sources from metadata if present
  let sources: SourceReference[] | undefined;
  if (msg.metadata) {
    try {
      const parsed = JSON.parse(msg.metadata);
      if (Array.isArray(parsed)) {
        sources = parsed;
      }
    } catch (e) {
      console.warn(`Failed to parse chat metadata for message ${msg.id}:`, e);
    }
  }

  return {
    id: msg.id,
    journalId: msg.journal_id,
    role: msg.role,
    content: msg.content,
    timestamp: new Date(msg.created_at),
    isStreaming: false,
    sources,
  };
}
