import { useMemo, useState, useCallback } from "react";
import {
  FileText,
  Calendar,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { useEntries, useJournalStats } from "../../hooks/use-journal";
import { useStreakInfo, useEmotionTrends, useOnThisDay } from "../../hooks/use-dashboard";
import { useTemplates } from "../../hooks/use-templates";
import { useUIStore } from "../../stores/ui-store";
import { Skeleton } from "../ui/Skeleton";
import { TemplateIcon } from "../templates/IconPicker";
import { StreakCard } from "./StreakCard";
import { WeekEmotions } from "./WeekEmotions";
import { MonthlyCalendar } from "./MonthlyCalendar";
import { OnThisDay } from "./OnThisDay";
import { DailyPrompt } from "./DailyPrompt";
import { selectFeaturedTemplates, getTimeOfDayGreeting } from "../../lib/stats-utils";
import { deriveTitle, formatEntryDate } from "../../lib/entry-utils";
import type { JournalEntry } from "../../types/journal";
import type { Template } from "../../types/templates";

export function Dashboard() {
  const { openEditor, openEditorWithTemplate, setActiveView } = useUIStore();
  const { data: stats, isLoading: statsLoading } = useJournalStats();
  const { data: streakInfo, isLoading: streakLoading } = useStreakInfo();
  const { data: entries, isLoading: entriesLoading } = useEntries({ limit: 5, archived: false });
  const { data: templates, isLoading: templatesLoading } = useTemplates();
  const { data: onThisDayEntries, isLoading: onThisDayLoading } = useOnThisDay();

  // Date range for emotion trends (current week + current month)
  const today = new Date();
  const weekStart = format(startOfWeek(today, { weekStartsOn: 0 }), "yyyy-MM-dd");
  const weekEnd = format(endOfWeek(today, { weekStartsOn: 0 }), "yyyy-MM-dd");

  const [monthRange, setMonthRange] = useState(() => ({
    start: format(startOfMonth(today), "yyyy-MM-dd"),
    end: format(endOfMonth(today), "yyyy-MM-dd"),
  }));

  // Fetch emotion trends for the week
  const { data: weekEmotions, isLoading: weekEmotionsLoading } = useEmotionTrends(
    weekStart,
    weekEnd
  );

  // Fetch emotion trends for the selected month
  const { data: monthEmotions, isLoading: monthEmotionsLoading } = useEmotionTrends(
    monthRange.start,
    monthRange.end
  );

  const featuredTemplates = templates ? selectFeaturedTemplates(templates, 2) : [];
  const greeting = getTimeOfDayGreeting();

  const handleUseTemplate = useCallback((template: Template) => {
    openEditorWithTemplate(template.template_text, template.title);
  }, [openEditorWithTemplate]);

  const handleOpenEntry = useCallback((entryId: string) => {
    openEditor(entryId);
  }, [openEditor]);

  const handleStartWithPrompt = useCallback((prompt: string) => {
    openEditorWithTemplate(`${prompt}\n\n`, "Journal Entry");
  }, [openEditorWithTemplate]);

  const handleMonthChange = useCallback((start: string, end: string) => {
    setMonthRange({ start, end });
  }, []);

  // Memoize the stats to prevent unnecessary re-renders
  const statCards = useMemo(() => ({
    totalEntries: stats?.total_entries ?? 0,
    entriesThisWeek: stats?.entries_this_week ?? 0,
    entriesThisMonth: stats?.entries_this_month ?? 0,
  }), [stats]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* Greeting */}
        <section className="text-center">
          <h1 className="text-2xl font-semibold text-sanctuary-text">
            {greeting}
          </h1>
          <p className="text-sanctuary-muted mt-1">
            What's on your mind today?
          </p>
        </section>

        {/* Streak and Week Emotions - Side by Side on larger screens */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <StreakCard
            currentStreak={streakInfo?.current_streak ?? 0}
            longestStreak={streakInfo?.longest_streak ?? 0}
            isLoading={streakLoading}
          />
          <WeekEmotions
            emotionData={weekEmotions ?? []}
            isLoading={weekEmotionsLoading}
          />
        </section>

        {/* Stats Row */}
        <section>
          <h2 className="text-xs font-medium text-sanctuary-muted uppercase tracking-wider mb-3">
            Your Progress
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              icon={<FileText className="h-5 w-5" />}
              value={statCards.totalEntries}
              label="Total Entries"
              isLoading={statsLoading}
            />
            <StatCard
              icon={<Calendar className="h-5 w-5" />}
              value={statCards.entriesThisWeek}
              label="This Week"
              isLoading={statsLoading}
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5" />}
              value={statCards.entriesThisMonth}
              label="This Month"
              isLoading={statsLoading}
            />
          </div>
        </section>

        {/* Monthly Calendar */}
        <section>
          <h2 className="text-xs font-medium text-sanctuary-muted uppercase tracking-wider mb-3">
            Monthly Overview
          </h2>
          <MonthlyCalendar
            emotionData={monthEmotions ?? []}
            isLoading={monthEmotionsLoading}
            onMonthChange={handleMonthChange}
          />
        </section>

        {/* On This Day + Daily Prompt - Side by Side */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(onThisDayEntries && onThisDayEntries.length > 0) || onThisDayLoading ? (
            <OnThisDay
              entries={onThisDayEntries ?? []}
              isLoading={onThisDayLoading}
              onOpenEntry={handleOpenEntry}
            />
          ) : null}
          <DailyPrompt onStartWriting={handleStartWithPrompt} />
        </section>

        {/* Recent Entries */}
        <section>
          <h2 className="text-xs font-medium text-sanctuary-muted uppercase tracking-wider mb-3">
            Recent Entries
          </h2>
          {entriesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <RecentEntryCardSkeleton key={i} />
              ))}
            </div>
          ) : !entries || entries.length === 0 ? (
            <div className="bg-sanctuary-card border border-sanctuary-border rounded-xl p-6 text-center">
              <p className="text-sanctuary-muted">No entries yet.</p>
              <p className="text-sm text-sanctuary-muted/70 mt-1">
                Start writing to see your recent entries here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <RecentEntryCard
                  key={entry.id}
                  entry={entry}
                  onClick={() => handleOpenEntry(entry.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Featured Templates */}
        {!templatesLoading && featuredTemplates.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-medium text-sanctuary-muted uppercase tracking-wider">
                Start Writing
              </h2>
              <button
                onClick={() => setActiveView("library")}
                className="text-xs text-sanctuary-accent hover:underline flex items-center gap-1"
              >
                View all prompts
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {featuredTemplates.map((template) => (
                <FeaturedTemplateCard
                  key={template.id}
                  template={template}
                  onClick={() => handleUseTemplate(template)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  isLoading?: boolean;
}

function StatCard({ icon, value, label, isLoading }: StatCardProps) {
  return (
    <div className="bg-sanctuary-card border border-sanctuary-border rounded-xl p-4">
      <div className="w-9 h-9 rounded-full flex items-center justify-center mb-2 bg-sanctuary-accent/10 text-sanctuary-accent">
        {icon}
      </div>
      {isLoading ? (
        <Skeleton className="h-7 w-12 mb-1" />
      ) : (
        <div className="text-2xl font-semibold text-sanctuary-text">{value}</div>
      )}
      <div className="text-xs text-sanctuary-muted">{label}</div>
    </div>
  );
}

interface RecentEntryCardProps {
  entry: JournalEntry;
  onClick: () => void;
}

function RecentEntryCard({ entry, onClick }: RecentEntryCardProps) {
  const title = entry.title || deriveTitle(entry.content);
  const preview = entry.content.slice(0, 100);

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-sanctuary-card border border-sanctuary-border rounded-lg p-3 hover:bg-sanctuary-hover transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-sanctuary-text truncate">{title}</h3>
          <p className="text-sm text-sanctuary-muted line-clamp-1 mt-0.5">
            {preview}
          </p>
        </div>
        <time className="text-xs text-sanctuary-muted whitespace-nowrap">
          {formatEntryDate(entry.created_at)}
        </time>
      </div>
    </button>
  );
}

function RecentEntryCardSkeleton() {
  return (
    <div className="bg-sanctuary-card border border-sanctuary-border rounded-lg p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

interface FeaturedTemplateCardProps {
  template: Template;
  onClick: () => void;
}

function FeaturedTemplateCard({ template, onClick }: FeaturedTemplateCardProps) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-sanctuary-card border border-sanctuary-border rounded-xl p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-sanctuary-accent/10 flex items-center justify-center text-sanctuary-accent flex-shrink-0">
          <TemplateIcon icon={template.icon} size="md" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-sanctuary-text">{template.title}</h3>
          <p className="text-sm text-sanctuary-muted line-clamp-2 mt-0.5">
            {template.template_text}
          </p>
        </div>
      </div>
    </button>
  );
}
