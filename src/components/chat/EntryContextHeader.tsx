import { NotePencil, X } from "@phosphor-icons/react";
import { useEntry } from "../../hooks/use-journal";
import { cn } from "../../lib/utils";

interface EntryContextHeaderProps {
  journalId: string;
  onClearContext?: () => void;
  className?: string;
}

/**
 * Shows entry context at the top of the AI sidebar when discussing a specific entry.
 * Displays entry title and date. Emotions are shown separately in EmotionPulse.
 */
export function EntryContextHeader({
  journalId,
  onClearContext,
  className,
}: EntryContextHeaderProps) {
  const { data: entry, isLoading: entryLoading } = useEntry(journalId);

  // Derive display title from entry
  const displayTitle = entry?.title || deriveTitle(entry?.content) || "Untitled";
  const displayDate = entry?.created_at
    ? formatEntryDate(entry.created_at)
    : "";

  if (entryLoading) {
    return (
      <div className={cn("px-3 py-2", className)}>
        <div className="flex items-center gap-2">
          <div className="h-4 w-32 animate-pulse rounded bg-sanctuary-border" />
        </div>
      </div>
    );
  }

  if (!entry) return null;

  return (
    <div
      className={cn(
        "px-3 py-2 bg-sanctuary-card/50",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Entry indicator */}
          <div className="flex items-center gap-1.5 text-[10px] text-sanctuary-muted mb-0.5">
            <NotePencil className="h-3 w-3" />
            <span>Discussing this entry</span>
          </div>

          {/* Title and date */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-sanctuary-text truncate">
              {displayTitle}
            </span>
            {displayDate && (
              <span className="text-xs text-sanctuary-muted shrink-0">
                {displayDate}
              </span>
            )}
          </div>
        </div>

        {/* Clear context button */}
        {onClearContext && (
          <button
            onClick={onClearContext}
            className="p-1 rounded-md text-sanctuary-muted hover:text-sanctuary-text hover:bg-sanctuary-hover transition-colors cursor-pointer"
            title="Switch to global chat"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Derives a title from content by taking the first line or first few words.
 */
function deriveTitle(content: string | undefined): string | null {
  if (!content) return null;

  // Get first line, strip markdown heading markers
  const firstLine = content.split("\n")[0].replace(/^#+\s*/, "").trim();

  if (firstLine.length === 0) return null;
  if (firstLine.length <= 40) return firstLine;

  // Truncate at word boundary
  const truncated = firstLine.substring(0, 40);
  const lastSpace = truncated.lastIndexOf(" ");
  return lastSpace > 20 ? truncated.substring(0, lastSpace) + "..." : truncated + "...";
}

/**
 * Formats entry date for display (relative if recent, otherwise short date).
 */
function formatEntryDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Today";
  } else if (diffDays === 1) {
    return "Yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }
}
