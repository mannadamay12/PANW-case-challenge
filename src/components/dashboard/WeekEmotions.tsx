import { format, startOfWeek, addDays, isSameDay, isAfter } from "date-fns";
import { Skeleton } from "../ui/Skeleton";
import { cn } from "../../lib/utils";
import type { DayEmotions } from "../../hooks/use-dashboard";

interface WeekEmotionsProps {
  emotionData: DayEmotions[];
  isLoading?: boolean;
}

// Mapping emotions to display info
const EMOTION_DISPLAY: Record<string, { emoji: string; color: string }> = {
  joy: { emoji: "😊", color: "bg-yellow-100 text-yellow-600" },
  gratitude: { emoji: "🙏", color: "bg-green-100 text-green-600" },
  love: { emoji: "❤️", color: "bg-pink-100 text-pink-600" },
  optimism: { emoji: "🌟", color: "bg-amber-100 text-amber-600" },
  sadness: { emoji: "😢", color: "bg-blue-100 text-blue-600" },
  anxiety: { emoji: "😰", color: "bg-purple-100 text-purple-600" },
  anger: { emoji: "😠", color: "bg-red-100 text-red-600" },
  fear: { emoji: "😨", color: "bg-slate-100 text-slate-600" },
  neutral: { emoji: "😐", color: "bg-stone-100 text-stone-600" },
  surprise: { emoji: "😲", color: "bg-cyan-100 text-cyan-600" },
  excitement: { emoji: "🎉", color: "bg-orange-100 text-orange-600" },
  relief: { emoji: "😌", color: "bg-teal-100 text-teal-600" },
  amusement: { emoji: "😄", color: "bg-lime-100 text-lime-600" },
  pride: { emoji: "😊", color: "bg-indigo-100 text-indigo-600" },
  admiration: { emoji: "✨", color: "bg-violet-100 text-violet-600" },
  confusion: { emoji: "😕", color: "bg-gray-100 text-gray-600" },
  disappointment: { emoji: "😞", color: "bg-slate-100 text-slate-600" },
  disapproval: { emoji: "😒", color: "bg-red-50 text-red-500" },
  disgust: { emoji: "🤢", color: "bg-green-50 text-green-700" },
  embarrassment: { emoji: "😳", color: "bg-rose-100 text-rose-600" },
  curiosity: { emoji: "🤔", color: "bg-sky-100 text-sky-600" },
  caring: { emoji: "🤗", color: "bg-pink-50 text-pink-500" },
  desire: { emoji: "😍", color: "bg-rose-100 text-rose-500" },
  grief: { emoji: "😭", color: "bg-blue-100 text-blue-700" },
  nervousness: { emoji: "😬", color: "bg-yellow-50 text-yellow-700" },
  realization: { emoji: "💡", color: "bg-amber-50 text-amber-600" },
  remorse: { emoji: "😔", color: "bg-slate-100 text-slate-500" },
  approval: { emoji: "👍", color: "bg-green-50 text-green-500" },
};

function getEmotionDisplay(emotion: string | null) {
  if (!emotion) return null;
  const key = emotion.toLowerCase();
  return EMOTION_DISPLAY[key] || { emoji: "📝", color: "bg-stone-100 text-stone-600" };
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
                    ? "bg-stone-50 text-stone-300"
                    : dayData
                      ? display?.color || "bg-sanctuary-accent/10"
                      : "bg-stone-100 border border-dashed border-stone-300",
                  isCurrentDay && "ring-2 ring-sanctuary-accent ring-offset-2"
                )}
              >
                {isFuture ? (
                  ""
                ) : dayData && display ? (
                  <span title={dayData.dominant_emotion || undefined}>
                    {display.emoji}
                  </span>
                ) : (
                  <span className="text-stone-400 text-xs">-</span>
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
