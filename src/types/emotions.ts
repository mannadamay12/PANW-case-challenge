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

// Emotion configuration for visual display
export interface EmotionConfig {
  emoji: string;
  color: string;
}

export const EMOTION_CONFIG: Record<string, EmotionConfig> = {
  // Positive - Warm (amber/yellow)
  joy: { emoji: "😊", color: "bg-amber-400/80" },
  love: { emoji: "❤️", color: "bg-rose-400/80" },
  admiration: { emoji: "🤩", color: "bg-amber-300/80" },
  gratitude: { emoji: "🙏", color: "bg-amber-400/80" },
  excitement: { emoji: "🎉", color: "bg-orange-400/80" },
  amusement: { emoji: "😄", color: "bg-yellow-400/80" },
  optimism: { emoji: "😎", color: "bg-amber-500/80" },
  pride: { emoji: "🦁", color: "bg-orange-300/80" },
  approval: { emoji: "👍", color: "bg-green-400/80" },
  caring: { emoji: "🤗", color: "bg-pink-300/80" },
  desire: { emoji: "😍", color: "bg-rose-300/80" },
  relief: { emoji: "😌", color: "bg-teal-300/80" },

  // Negative - Cool/Red
  anger: { emoji: "😠", color: "bg-red-500/80" },
  annoyance: { emoji: "😒", color: "bg-red-400/80" },
  fear: { emoji: "😨", color: "bg-purple-400/80" },
  sadness: { emoji: "😢", color: "bg-blue-400/80" },
  grief: { emoji: "😭", color: "bg-blue-500/80" },
  disappointment: { emoji: "😞", color: "bg-slate-400/80" },
  disapproval: { emoji: "👎", color: "bg-red-300/80" },
  disgust: { emoji: "🤢", color: "bg-green-600/80" },
  embarrassment: { emoji: "😳", color: "bg-pink-400/80" },
  remorse: { emoji: "😔", color: "bg-indigo-400/80" },
  nervousness: { emoji: "😰", color: "bg-yellow-500/80" },

  // Cognitive - Purple/Blue
  confusion: { emoji: "😕", color: "bg-purple-300/80" },
  curiosity: { emoji: "🤔", color: "bg-cyan-400/80" },
  surprise: { emoji: "😮", color: "bg-violet-400/80" },
  realization: { emoji: "💡", color: "bg-yellow-300/80" },

  // Neutral
  neutral: { emoji: "😐", color: "bg-slate-300/80" },
};

const DEFAULT_CONFIG: EmotionConfig = { emoji: "○", color: "bg-slate-300/80" };

export function getEmotionEmoji(emotion: string): string {
  return EMOTION_CONFIG[emotion.toLowerCase()]?.emoji ?? DEFAULT_CONFIG.emoji;
}

export function getEmotionBgColor(emotion: string): string {
  return EMOTION_CONFIG[emotion.toLowerCase()]?.color ?? DEFAULT_CONFIG.color;
}
