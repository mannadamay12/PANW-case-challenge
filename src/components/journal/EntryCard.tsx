import { useState } from "react";
import { Archive, ArrowCounterClockwise, Trash } from "@phosphor-icons/react";
import type { JournalEntry } from "../../types/journal";
import { useArchiveEntry, useUnarchiveEntry, useUpdateEntry } from "../../hooks/use-journal";
import { useUIStore } from "../../stores/ui-store";
import { cn } from "../../lib/utils";
import { DatePicker } from "../ui/DatePicker";
import { deriveTitle, formatEntryDate } from "../../lib/entry-utils";

interface EntryCardProps {
  entry: JournalEntry;
  isSelected?: boolean;
  animationDelay?: number;
}

export function EntryCard({ entry, isSelected, animationDelay = 0 }: EntryCardProps) {
  const { setSelectedEntryId, openEditor, setDeleteConfirmId } = useUIStore();
  const archiveMutation = useArchiveEntry();
  const unarchiveMutation = useUnarchiveEntry();
  const updateMutation = useUpdateEntry();
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleClick = () => {
    setSelectedEntryId(entry.id);
    openEditor(entry.id);
  };

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    archiveMutation.mutate(entry.id);
  };

  const handleUnarchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    unarchiveMutation.mutate(entry.id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(entry.id);
  };

  const handleDateClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDatePicker(true);
  };

  const handleDateChange = (newDate: string) => {
    updateMutation.mutate({
      id: entry.id,
      created_at: newDate,
    });
  };

  // Use AI-generated title or derive from content
  const title = entry.title || deriveTitle(entry.content);

  // Get preview text (skip first line if it matches the derived title)
  const firstLine = entry.content.split("\n")[0].trim();
  const previewLines = entry.content.split("\n");
  const previewContent =
    !entry.title && firstLine === title
      ? previewLines.slice(1).join("\n").trim()
      : entry.content;
  const previewText = previewContent.slice(0, 80);
  const hasMore = previewContent.length > 80;

  return (
    <div
      onClick={handleClick}
      className={cn(
        "group relative px-4 py-3 cursor-pointer transition-colors animate-slide-up",
        isSelected ? "bg-sanctuary-selected" : "hover:bg-sanctuary-hover",
        entry.is_archived && "opacity-60"
      )}
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Title */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-semibold text-sm text-sanctuary-text line-clamp-1">
          {title}
        </h4>

        {/* Action buttons */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {entry.is_archived ? (
            <button
              onClick={handleUnarchive}
              title="Unarchive"
              className={cn(
                "p-1 rounded text-sanctuary-muted transition-colors",
                "hover:bg-sanctuary-hover hover:text-sanctuary-text"
              )}
            >
              <ArrowCounterClockwise className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleArchive}
              title="Archive"
              className={cn(
                "p-1 rounded text-sanctuary-muted transition-colors",
                "hover:bg-sanctuary-hover hover:text-sanctuary-text"
              )}
            >
              <Archive className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={handleDelete}
            title="Delete"
            className={cn(
              "p-1 rounded text-sanctuary-muted transition-colors",
              "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
            )}
          >
            <Trash className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content preview */}
      {previewText && (
        <p className="mt-1 text-sm text-sanctuary-muted line-clamp-2">
          {previewText}
          {hasMore && "..."}
        </p>
      )}

      {/* Date and archived badge */}
      <div className="mt-1 flex items-center gap-2 relative">
        <button
          onClick={handleDateClick}
          className="text-xs text-sanctuary-muted hover:text-sanctuary-text hover:underline transition-colors"
        >
          {formatEntryDate(entry.created_at)}
        </button>
        {showDatePicker && (
          <DatePicker
            value={entry.created_at}
            onChange={handleDateChange}
            onClose={() => setShowDatePicker(false)}
          />
        )}
        {entry.is_archived && (
          <span className="text-xs text-sanctuary-muted bg-sanctuary-hover px-1.5 py-0.5 rounded">
            Archived
          </span>
        )}
      </div>
    </div>
  );
}
