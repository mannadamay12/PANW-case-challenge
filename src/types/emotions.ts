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

// Emotion display configuration
export const EMOTION_COLORS: Record<string, string> = {
  // Positive emotions
  joy: "bg-yellow-100 text-yellow-800",
  love: "bg-pink-100 text-pink-800",
  admiration: "bg-purple-100 text-purple-800",
  gratitude: "bg-green-100 text-green-800",
  optimism: "bg-lime-100 text-lime-800",
  excitement: "bg-orange-100 text-orange-800",
  amusement: "bg-amber-100 text-amber-800",
  pride: "bg-indigo-100 text-indigo-800",
  relief: "bg-teal-100 text-teal-800",
  approval: "bg-emerald-100 text-emerald-800",
  caring: "bg-rose-100 text-rose-800",
  desire: "bg-fuchsia-100 text-fuchsia-800",

  // Negative emotions
  sadness: "bg-blue-100 text-blue-800",
  anger: "bg-red-100 text-red-800",
  fear: "bg-slate-100 text-slate-800",
  disappointment: "bg-gray-100 text-gray-800",
  annoyance: "bg-orange-100 text-orange-800",
  disapproval: "bg-red-100 text-red-800",
  disgust: "bg-green-100 text-green-800",
  embarrassment: "bg-pink-100 text-pink-800",
  grief: "bg-indigo-100 text-indigo-800",
  nervousness: "bg-violet-100 text-violet-800",
  remorse: "bg-purple-100 text-purple-800",

  // Cognitive emotions
  confusion: "bg-amber-100 text-amber-800",
  curiosity: "bg-cyan-100 text-cyan-800",
  realization: "bg-sky-100 text-sky-800",
  surprise: "bg-yellow-100 text-yellow-800",

  // Neutral
  neutral: "bg-gray-100 text-gray-600",
};

// Get display color for an emotion
export function getEmotionColor(emotion: string): string {
  return EMOTION_COLORS[emotion.toLowerCase()] ?? "bg-gray-100 text-gray-600";
}
