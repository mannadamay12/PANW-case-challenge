import { useEntryEmotions } from "../../hooks/use-ml";
import { getEmotionEmoji, getEmotionBgColor } from "../../types/emotions";
import { cn } from "../../lib/utils";

interface EmotionPulseProps {
  journalId: string | null;
  className?: string;
}

/**
 * Displays detected emotions for the current entry as animated badges.
 * Shows top 3 emotions with emoji, label, and confidence bar.
 */
export function EmotionPulse({ journalId, className }: EmotionPulseProps) {
  const { data: emotions, isLoading } = useEntryEmotions(journalId);

  if (!journalId) return null;

  if (isLoading) {
    return (
      <div className={cn("flex gap-2 p-2", className)}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-6 w-16 animate-pulse rounded-full bg-sanctuary-border"
          />
        ))}
      </div>
    );
  }

  if (!emotions || emotions.length === 0) return null;

  const topEmotions = emotions.slice(0, 3);
  const maxScore = Math.max(...topEmotions.map((e) => e.score));

  return (
    <div className={cn("flex flex-wrap gap-1.5 p-2", className)}>
      {topEmotions.map((emotion, index) => {
        const normalizedWidth = (emotion.score / maxScore) * 100;
        return (
          <div
            key={emotion.label}
            className={cn(
              "group relative flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium overflow-hidden",
              "transition-all duration-200 cursor-default select-none",
              getEmotionBgColor(emotion.label),
              "text-white/90 shadow-sm",
              "animate-slide-up",
            )}
            style={{
              animationDelay: `${index * 75}ms`,
              animationFillMode: "backwards",
            }}
            title={`${emotion.label}: ${Math.round(emotion.score * 100)}% confidence`}
          >
            <span className="text-sm">{getEmotionEmoji(emotion.label)}</span>
            <span className="capitalize">{emotion.label}</span>

            {/* Confidence bar - no background track, just the fill */}
            <div
              className="absolute bottom-0 left-0 h-0.5 bg-white/50 rounded-full"
              style={{ width: `${normalizedWidth}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}
