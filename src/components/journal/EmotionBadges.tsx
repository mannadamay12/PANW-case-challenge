import { useEntryEmotions } from "../../hooks/use-ml";
import { getEmotionColor } from "../../types/emotions";
import { cn } from "../../lib/utils";

interface EmotionBadgesProps {
  entryId: string;
  className?: string;
  maxBadges?: number;
  compact?: boolean;
}

export function EmotionBadges({
  entryId,
  className,
  maxBadges = 3,
  compact = false,
}: EmotionBadgesProps) {
  const { data: emotions, isLoading, error } = useEntryEmotions(entryId);

  if (error) {
    return null;
  }

  if (isLoading) {
    return (
      <div className={cn("flex gap-1", className)}>
        <span className="h-5 w-12 animate-pulse rounded-full bg-sanctuary-border" />
      </div>
    );
  }

  if (!emotions || emotions.length === 0) {
    return null;
  }

  const displayEmotions = emotions.slice(0, maxBadges);
  const remaining = emotions.length - maxBadges;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {displayEmotions.map((emotion) => (
        <span
          key={emotion.label}
          className={cn(
            "inline-flex items-center rounded-full font-medium capitalize",
            compact ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs",
            getEmotionColor(emotion.label)
          )}
          title={`${emotion.label}: ${Math.round(emotion.score * 100)}%`}
        >
          {emotion.label}
        </span>
      ))}
      {remaining > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sanctuary-hover text-sanctuary-muted">
          +{remaining}
        </span>
      )}
    </div>
  );
}
