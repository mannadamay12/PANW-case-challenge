import type { JournalEntry } from "./journal";

export interface EmotionPrediction {
  label: string;
  score: number;
}

export interface ModelStatus {
  embedding_downloaded: boolean;
  sentiment_downloaded: boolean;
  models_dir: string;
}

export interface HybridSearchResult {
  journal: JournalEntry;
  score: number;
  fts_rank: number | null;
  vec_rank: number | null;
}

export interface HybridSearchParams {
  query: string;
  limit?: number;
  includeArchived?: boolean;
}

// Muted emotion display - all emotions use the same subtle grey styling with dark mode support
const MUTED_EMOTION_STYLE = "bg-sanctuary-hover text-sanctuary-muted";

// Get display color for an emotion (now always returns muted grey)
export function getEmotionColor(_emotion: string): string {
  return MUTED_EMOTION_STYLE;
}
