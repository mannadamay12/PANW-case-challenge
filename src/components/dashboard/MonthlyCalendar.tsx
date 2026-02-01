import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isAfter,
  parseISO,
} from "date-fns";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { useState } from "react";
import { Skeleton } from "../ui/Skeleton";
import { cn } from "../../lib/utils";
import type { DayEmotions } from "../../hooks/use-dashboard";

interface MonthlyCalendarProps {
  emotionData: DayEmotions[];
  isLoading?: boolean;
  onMonthChange?: (startDate: string, endDate: string) => void;
}

// Simplified emotion colors for the calendar heatmap
const EMOTION_COLORS: Record<string, string> = {
  joy: "bg-yellow-400",
  gratitude: "bg-green-400",
  love: "bg-pink-400",
  optimism: "bg-amber-400",
  excitement: "bg-orange-400",
  amusement: "bg-lime-400",
  pride: "bg-indigo-400",
  admiration: "bg-violet-400",
  relief: "bg-teal-400",
  approval: "bg-emerald-400",
  caring: "bg-rose-400",
  curiosity: "bg-sky-400",
  desire: "bg-fuchsia-400",
  realization: "bg-yellow-300",
  surprise: "bg-cyan-400",
  neutral: "bg-stone-400",
  sadness: "bg-blue-400",
  anxiety: "bg-purple-400",
  fear: "bg-slate-400",
  anger: "bg-red-400",
  disappointment: "bg-slate-500",
  disapproval: "bg-red-300",
  confusion: "bg-gray-400",
  disgust: "bg-green-600",
  embarrassment: "bg-rose-500",
  grief: "bg-blue-600",
  nervousness: "bg-yellow-600",
  remorse: "bg-slate-500",
};

function getEmotionColor(emotion: string | null): string {
  if (!emotion) return "bg-sanctuary-accent";
  const key = emotion.toLowerCase();
  return EMOTION_COLORS[key] || "bg-sanctuary-accent";
}

export function MonthlyCalendar({
  emotionData,
  isLoading,
  onMonthChange,
}: MonthlyCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = new Date();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Map dates to emotion data
  const emotionByDate = new Map(emotionData.map((d) => [d.date, d]));

  // Calculate stats for the month
  const monthEmotions = emotionData.filter((d) => {
    const date = parseISO(d.date);
    return isSameMonth(date, currentDate);
  });
  const totalEntries = monthEmotions.reduce((sum, d) => sum + d.entry_count, 0);
  const emotionCounts = monthEmotions.reduce(
    (acc, d) => {
      if (d.dominant_emotion) {
        acc[d.dominant_emotion] = (acc[d.dominant_emotion] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>
  );
  const topEmotions = Object.entries(emotionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);

  const handlePrevMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    setCurrentDate(newDate);
    if (onMonthChange) {
      onMonthChange(
        format(startOfMonth(newDate), "yyyy-MM-dd"),
        format(endOfMonth(newDate), "yyyy-MM-dd")
      );
    }
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    setCurrentDate(newDate);
    if (onMonthChange) {
      onMonthChange(
        format(startOfMonth(newDate), "yyyy-MM-dd"),
        format(endOfMonth(newDate), "yyyy-MM-dd")
      );
    }
  };

  if (isLoading) {
    return <MonthlyCalendarSkeleton />;
  }

  return (
    <div className="bg-sanctuary-card border border-sanctuary-border rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-sanctuary-text">
          {format(currentDate, "MMMM yyyy")}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevMonth}
            className="p-1 rounded-md hover:bg-sanctuary-hover text-sanctuary-muted transition-colors"
          >
            <CaretLeft className="h-5 w-5" />
          </button>
          <button
            onClick={handleNextMonth}
            disabled={isSameMonth(currentDate, today)}
            className={cn(
              "p-1 rounded-md transition-colors",
              isSameMonth(currentDate, today)
                ? "text-sanctuary-border cursor-not-allowed"
                : "hover:bg-sanctuary-hover text-sanctuary-muted"
            )}
          >
            <CaretRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 mb-4">
        {/* Day headers */}
        {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
          <div
            key={i}
            className="text-center text-xs font-medium text-sanctuary-muted py-1"
          >
            {day}
          </div>
        ))}

        {/* Days */}
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayData = emotionByDate.get(dateStr);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isSameDay(day, today);
          const isFuture = isAfter(day, today);
          const hasEntry = dayData && dayData.entry_count > 0;

          return (
            <div
              key={dateStr}
              className={cn(
                "aspect-square flex items-center justify-center text-sm relative",
                !isCurrentMonth && "text-sanctuary-border"
              )}
            >
              {hasEntry && !isFuture && (
                <div
                  className={cn(
                    "absolute inset-1 rounded-full opacity-70",
                    getEmotionColor(dayData.dominant_emotion)
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10",
                  isCurrentDay &&
                    "font-bold text-sanctuary-accent underline underline-offset-2",
                  hasEntry && !isFuture && "text-white font-medium"
                )}
              >
                {format(day, "d")}
              </span>
            </div>
          );
        })}
      </div>

      {/* Stats */}
      <div className="pt-3 border-t border-sanctuary-border text-sm text-sanctuary-muted">
        <span className="font-medium text-sanctuary-text">{totalEntries}</span>{" "}
        {totalEntries === 1 ? "entry" : "entries"}
        {topEmotions.length > 0 && (
          <>
            <span className="mx-2">·</span>
            Top:{" "}
            {topEmotions.map(([emotion, count], i) => (
              <span key={emotion}>
                {i > 0 && ", "}
                <span className="capitalize">{emotion}</span>
                <span className="text-sanctuary-muted/70">
                  {" "}
                  ({Math.round((count / monthEmotions.length) * 100)}%)
                </span>
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function MonthlyCalendarSkeleton() {
  return (
    <div className="bg-sanctuary-card border border-sanctuary-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-32" />
        <div className="flex gap-1">
          <Skeleton className="h-7 w-7" />
          <Skeleton className="h-7 w-7" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={`header-${i}`} className="h-6" />
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-full" />
        ))}
      </div>
      <div className="pt-3 border-t border-sanctuary-border">
        <Skeleton className="h-4 w-48" />
      </div>
    </div>
  );
}
