import { format, startOfWeek, addDays, isSameDay, isAfter } from "date-fns";
import { Skeleton } from "../ui/Skeleton";
import { cn } from "../../lib/utils";
import type { DayEmotions } from "../../hooks/use-dashboard";

interface WeekEmotionsProps {
  emotionData: DayEmotions[];
  isLoading?: boolean;
}

// Mapping emotions to display info - using sanctuary theme for consistent dark mode
const EMOTION_DISPLAY: Record<string, { emoji: string }> = {
  joy: { emoji: "😊" },
  gratitude: { emoji: "🙏" },
  love: { emoji: "❤️" },
  optimism: { emoji: "🌟" },
  sadness: { emoji: "😢" },
  anxiety: { emoji: "😰" },
  anger: { emoji: "😠" },
  fear: { emoji: "😨" },
  neutral: { emoji: "😐" },
  surprise: { emoji: "😲" },
  excitement: { emoji: "🎉" },
  relief: { emoji: "😌" },
  amusement: { emoji: "😄" },
  pride: { emoji: "😊" },
  admiration: { emoji: "✨" },
  confusion: { emoji: "😕" },
  disappointment: { emoji: "😞" },
  disapproval: { emoji: "😒" },
  disgust: { emoji: "🤢" },
  embarrassment: { emoji: "😳" },
  curiosity: { emoji: "🤔" },
  caring: { emoji: "🤗" },
  desire: { emoji: "😍" },
  grief: { emoji: "😭" },
  nervousness: { emoji: "😬" },
  realization: { emoji: "💡" },
  remorse: { emoji: "😔" },
  approval: { emoji: "👍" },
};

function getEmotionDisplay(emotion: string | null) {
  if (!emotion) return null;
  const key = emotion.toLowerCase();
  return EMOTION_DISPLAY[key] || { emoji: "📝" };
}

export function WeekEmotions({ emotionData, isLoading }: WeekEmotionsProps) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Map dates to emotion data
  const emotionByDate = new Map(
    emotionData.map((d) => [d.date, d])
  );

  if (isLoading) {
    return <WeekEmotionsSkeleton />;
  }

  return (
    <div className="bg-sanctuary-card border border-sanctuary-border rounded-xl p-4">
      <h3 className="text-xs font-medium text-sanctuary-muted uppercase tracking-wider mb-3">
        This Week
      </h3>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayData = emotionByDate.get(dateStr);
          const isFuture = isAfter(day, today);
          const isCurrentDay = isSameDay(day, today);
          const display = dayData ? getEmotionDisplay(dayData.dominant_emotion) : null;

          return (
            <div key={dateStr} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "text-xs font-medium",
                  isCurrentDay ? "text-sanctuary-accent" : "text-sanctuary-muted"
                )}
              >
                {format(day, "EEE")}
              </span>
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-lg",
                  isFuture
                    ? "bg-sanctuary-bg text-sanctuary-border"
                    : dayData
                      ? "bg-sanctuary-accent/10"
                      : "bg-sanctuary-bg border border-dashed border-sanctuary-border",
                  isCurrentDay && "ring-2 ring-sanctuary-accent ring-offset-2 ring-offset-sanctuary-card"
                )}
              >
                {isFuture ? (
                  ""
                ) : dayData && display ? (
                  <span title={dayData.dominant_emotion || undefined}>
                    {display.emoji}
                  </span>
                ) : (
                  <span className="text-sanctuary-muted text-xs">-</span>
                )}
              </div>
              <span className="text-xs text-sanctuary-muted">
                {format(day, "d")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekEmotionsSkeleton() {
  return (
    <div className="bg-sanctuary-card border border-sanctuary-border rounded-xl p-4">
      <Skeleton className="h-4 w-20 mb-3" />
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-3 w-4" />
          </div>
        ))}
      </div>
    </div>
  );
}
