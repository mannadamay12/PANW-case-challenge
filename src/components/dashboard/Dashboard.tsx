import { useCallback } from "react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { useStreakInfo, useEmotionTrends, useOnThisDay } from "../../hooks/use-dashboard";
import { useUIStore } from "../../stores/ui-store";
import { StreakCard } from "./StreakCard";
import { WeekEmotions } from "./WeekEmotions";
import { OnThisDay } from "./OnThisDay";
import { DailyPrompt } from "./DailyPrompt";
import { SummaryCard } from "./SummaryCard";
import { getTimeOfDayGreeting } from "../../lib/stats-utils";

export function Dashboard() {
  const { openEditor, openEditorWithTemplate, setActiveView } = useUIStore();
  const { data: streakInfo, isLoading: streakLoading } = useStreakInfo();
  const { data: onThisDayEntries, isLoading: onThisDayLoading } = useOnThisDay();

  // Date range for emotion trends (current week)
  const today = new Date();
  const weekStart = format(startOfWeek(today, { weekStartsOn: 0 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(today, { weekStartsOn: 0 }), "yyyy-MM-dd");

  // Fetch emotion trends for the week
  const { data: weekEmotions, isLoading: weekEmotionsLoading } = useEmotionTrends(
    weekStart,
    weekEnd
  );

  const greeting = getTimeOfDayGreeting();

  const handleOpenEntry = useCallback((entryId: string) => {
    openEditor(entryId);
  }, [openEditor]);

  const handleStartWithPrompt = useCallback((prompt: string) => {
    openEditorWithTemplate(`${prompt}\n\n`, "Journal Entry");
  }, [openEditorWithTemplate]);

  const handleExploreGallery = useCallback(() => {
    setActiveView("library");
  }, [setActiveView]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Greeting */}
        <section className="text-center animate-fade-up">
          <h1 className="text-2xl font-semibold text-sanctuary-text">
            {greeting}
          </h1>
          <p className="text-sanctuary-muted mt-1">
            What's on your mind today?
          </p>
        </section>

        {/* Daily Prompt and Week Emotions - Side by Side on larger screens */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-up stagger-1">
          <DailyPrompt
            onStartWriting={handleStartWithPrompt}
            onExploreGallery={handleExploreGallery}
          />
          <WeekEmotions
            emotionData={weekEmotions ?? []}
            isLoading={weekEmotionsLoading}
          />
        </section>

        {/* AI Summary */}
        <section className="animate-fade-up stagger-2">
          <SummaryCard />
        </section>

        {/* On This Day */}
        {((onThisDayEntries && onThisDayEntries.length > 0) || onThisDayLoading) && (
          <section className="animate-fade-up stagger-3">
            <OnThisDay
              entries={onThisDayEntries ?? []}
              isLoading={onThisDayLoading}
              onOpenEntry={handleOpenEntry}
            />
          </section>
        )}

        {/* Streak Card */}
        <section className="animate-fade-up stagger-4">
          <StreakCard
            currentStreak={streakInfo?.current_streak ?? 0}
            longestStreak={streakInfo?.longest_streak ?? 0}
            isLoading={streakLoading}
          />
        </section>
      </div>
    </div>
  );
}
