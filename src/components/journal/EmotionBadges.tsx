import { useEntryEmotions } from "../../hooks/use-ml";
import { getEmotionColor } from "../../types/emotions";
import { cn } from "../../lib/utils";

interface EmotionBadgesProps {
  entryId: string;
  className?: string;
  maxBadges?: number;
}

export function EmotionBadges({
  entryId,
  className,
  maxBadges = 3,
}: EmotionBadgesProps) {
  const { data: emotions, isLoading } = useEntryEmotions(entryId);

  if (isLoading) {
    return (
      <div className={cn("flex gap-1", className)}>
        <span className="h-5 w-12 animate-pulse rounded-full bg-stone-200" />
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
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize",
            getEmotionColor(emotion.label)
          )}
          title={`${emotion.label}: ${Math.round(emotion.score * 100)}%`}
        >
          {emotion.label}
        </span>
      ))}
      {remaining > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
          +{remaining}
        </span>
      )}
    </div>
  );
}
