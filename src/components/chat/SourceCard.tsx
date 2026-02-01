import { NotePencil, ArrowSquareOut } from "@phosphor-icons/react";
import { useUIStore } from "../../stores/ui-store";
import { useEntryEmotions } from "../../hooks/use-ml";
import { getEmotionEmoji, getEmotionBgColor } from "../../types/emotions";
import { cn } from "../../lib/utils";
import type { SourceReference } from "../../types/chat";

interface SourceCardProps {
  source: SourceReference;
  compact?: boolean;
}

/**
 * A clickable card displaying a RAG source with entry preview,
 * emotion badge, date, relevance score, and navigation support.
 */
export function SourceCard({ source, compact = false }: SourceCardProps) {
  const openEditor = useUIStore((s) => s.openEditor);
  const { data: emotions } = useEntryEmotions(source.entry_id);

  const topEmotion = emotions?.[0];
  const displayDate = formatSourceDate(source.date);
  const relevancePercent = Math.round(source.score * 100);

  const handleClick = () => {
    openEditor(source.entry_id);
  };

  if (compact) {
    return (
      <button
        onClick={handleClick}
        className={cn(
          "flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg",
          "bg-sanctuary-bg/50 hover:bg-sanctuary-hover",
          "border border-sanctuary-border/50 hover:border-sanctuary-border",
          "transition-colors cursor-pointer group"
        )}
      >
        <NotePencil className="h-3.5 w-3.5 text-sanctuary-muted shrink-0" />
        <span className="flex-1 text-xs text-sanctuary-muted truncate">
          {displayDate}
        </span>
        {topEmotion && (
          <span
            className={cn(
              "text-[10px] px-1 py-0.5 rounded",
              getEmotionBgColor(topEmotion.label),
              "text-white/90"
            )}
          >
            {getEmotionEmoji(topEmotion.label)}
          </span>
        )}
        <ArrowSquareOut className="h-3 w-3 text-sanctuary-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex flex-col w-full text-left p-3 rounded-lg",
        "bg-sanctuary-bg/50 hover:bg-sanctuary-hover",
        "border border-sanctuary-border/50 hover:border-sanctuary-border",
        "transition-all cursor-pointer group"
      )}
    >
      {/* Header: date and emotion */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <NotePencil className="h-3.5 w-3.5 text-sanctuary-muted" />
          <span className="text-xs font-medium text-sanctuary-text">
            {displayDate}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {topEmotion && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full",
                getEmotionBgColor(topEmotion.label),
                "text-white/90"
              )}
            >
              <span>{getEmotionEmoji(topEmotion.label)}</span>
              <span className="capitalize">{topEmotion.label}</span>
            </span>
          )}
          <ArrowSquareOut className="h-3.5 w-3.5 text-sanctuary-muted opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Snippet preview */}
      <p className="text-xs text-sanctuary-muted line-clamp-2 mb-2">
        {source.snippet}
      </p>

      {/* Relevance bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full bg-sanctuary-border overflow-hidden">
          <div
            className="h-full bg-sanctuary-accent/60 transition-all duration-300"
            style={{ width: `${relevancePercent}%` }}
          />
        </div>
        <span className="text-[10px] text-sanctuary-muted tabular-nums">
          {relevancePercent}%
        </span>
      </div>
    </button>
  );
}

interface SourceCardListProps {
  sources: SourceReference[];
  compact?: boolean;
  maxVisible?: number;
}

/**
 * Renders a list of SourceCards with optional visibility limit.
 */
export function SourceCardList({
  sources,
  compact = false,
  maxVisible,
}: SourceCardListProps) {
  const displaySources = maxVisible ? sources.slice(0, maxVisible) : sources;
  const hiddenCount = maxVisible ? Math.max(0, sources.length - maxVisible) : 0;

  return (
    <div className={cn("flex flex-col", compact ? "gap-1" : "gap-2")}>
      {displaySources.map((source) => (
        <SourceCard key={source.entry_id} source={source} compact={compact} />
      ))}
      {hiddenCount > 0 && (
        <div className="text-[10px] text-sanctuary-muted text-center py-1">
          +{hiddenCount} more {hiddenCount === 1 ? "source" : "sources"}
        </div>
      )}
    </div>
  );
}

/**
 * Formats source date for display.
 */
function formatSourceDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: "short" });
  } else {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }
}
