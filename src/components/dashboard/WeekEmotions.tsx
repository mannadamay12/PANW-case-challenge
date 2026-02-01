import { format, startOfWeek, addDays, isSameDay, isAfter } from "date-fns";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Skeleton } from "../ui/Skeleton";
import { cn } from "../../lib/utils";
import { getEmotionEmoji, getEmotionBgColor } from "../../types/emotions";
import type { DayEmotions } from "../../hooks/use-dashboard";

interface WeekEmotionsProps {
  emotionData: DayEmotions[];
  isLoading?: boolean;
}

export function WeekEmotions({ emotionData, isLoading }: WeekEmotionsProps) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Map dates to emotion data
  const emotionByDate = new Map(emotionData.map((d) => [d.date, d]));

  // Check if a day has an entry
  const hasEntry = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    return emotionByDate.has(dateStr);
  };

  if (isLoading) {
    return <WeekEmotionsSkeleton />;
  }

  return (
    <Tooltip.Provider delayDuration={200}>
      <div className="bg-sanctuary-card border border-sanctuary-border rounded-xl p-4">
        <h3 className="text-xs font-medium text-sanctuary-muted uppercase tracking-wider mb-4">
          This Week
        </h3>
        <div className="flex items-center justify-between">
          {days.map((day, index) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayData = emotionByDate.get(dateStr);
            const isFuture = isAfter(day, today);
            const isCurrentDay = isSameDay(day, today);
            const dayHasEntry = !isFuture && !!dayData;
            const nextDay = days[index + 1];
            const nextHasEntry = nextDay && !isAfter(nextDay, today) && hasEntry(nextDay);
            const showConnector = dayHasEntry && nextHasEntry;

            const emotionEmoji = dayData?.dominant_emotion
              ? getEmotionEmoji(dayData.dominant_emotion)
              : null;
            const emotionBgColor = dayData?.dominant_emotion
              ? getEmotionBgColor(dayData.dominant_emotion)
              : null;

            return (
              <div key={dateStr} className="flex flex-col items-center gap-2 relative min-w-[44px]">
                {/* Day label */}
                <span
                  className={cn(
                    "text-xs font-medium",
                    isCurrentDay ? "text-sanctuary-accent" : "text-sanctuary-muted"
                  )}
                >
                  {isCurrentDay ? "Today" : format(day, "EEE")}
                </span>

                {/* Day indicator with optional connector */}
                <div className="relative flex items-center">
                  {/* Connector line to next day */}
                  {showConnector && (
                    <div className="absolute left-1/2 top-1/2 -translate-y-1/2 w-[calc(100%+1.5rem)] h-0.5 bg-sanctuary-accent/40 z-0" />
                  )}

                  {/* Circle indicator with emoji */}
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <div
                        className={cn(
                          "relative z-10 w-10 h-10 rounded-full transition-all animate-scale-in flex items-center justify-center text-lg",
                          isFuture
                            ? "border-2 border-dashed border-sanctuary-border/50"
                            : dayHasEntry && emotionBgColor
                              ? cn(emotionBgColor, "shadow-lg shadow-current/20")
                              : "border-2 border-dashed border-sanctuary-border",
                          isCurrentDay &&
                            "ring-2 ring-sanctuary-accent ring-offset-2 ring-offset-sanctuary-card"
                        )}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        {dayHasEntry && emotionEmoji && (
                          <span className="select-none">{emotionEmoji}</span>
                        )}
                      </div>
                    </Tooltip.Trigger>
                    {dayHasEntry && dayData?.dominant_emotion && (
                      <Tooltip.Portal>
                        <Tooltip.Content
                          className="bg-sanctuary-card border border-sanctuary-border rounded-lg px-3 py-2 shadow-lg z-50 animate-fade-in"
                          side="bottom"
                          sideOffset={5}
                        >
                          <span className="text-sm text-sanctuary-text capitalize">
                            {dayData.dominant_emotion}
                          </span>
                          <Tooltip.Arrow className="fill-sanctuary-card" />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    )}
                  </Tooltip.Root>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Tooltip.Provider>
  );
}

function WeekEmotionsSkeleton() {
  return (
    <div className="bg-sanctuary-card border border-sanctuary-border rounded-xl p-4">
      <Skeleton className="h-4 w-20 mb-4" />
      <div className="flex items-center justify-between">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 min-w-[44px]">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
