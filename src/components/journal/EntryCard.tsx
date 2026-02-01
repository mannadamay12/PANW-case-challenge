import { Archive, MoreHorizontal, Trash2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { JournalEntry } from "../../types/journal";
import { useArchiveEntry } from "../../hooks/use-journal";
import { useUIStore } from "../../stores/ui-store";
import { cn } from "../../lib/utils";
import { EmotionBadges } from "./EmotionBadges";
import { deriveTitle, formatEntryDate } from "../../lib/entry-utils";

interface EntryCardProps {
  entry: JournalEntry;
  isSelected?: boolean;
  animationDelay?: number;
}

export function EntryCard({ entry, isSelected, animationDelay = 0 }: EntryCardProps) {
  const { setSelectedEntryId, openEditor, setDeleteConfirmId } = useUIStore();
  const archiveMutation = useArchiveEntry();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const handleClick = () => {
    setSelectedEntryId(entry.id);
    openEditor(entry.id);
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

        {/* Actions menu */}
        <div
          ref={menuRef}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0"
        >
          <button
            onClick={() => setShowMenu(!showMenu)}
            className={cn(
              "p-1 rounded text-sanctuary-muted transition-colors",
              "opacity-0 group-hover:opacity-100 focus:opacity-100",
              "hover:bg-sanctuary-selected hover:text-sanctuary-text"
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>

          {showMenu && (
            <div className="absolute right-4 top-10 z-10 w-36 rounded-lg border border-sanctuary-border bg-sanctuary-card py-1 shadow-lg animate-scale-in origin-top-right">
              {!entry.is_archived && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    archiveMutation.mutate(entry.id);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-sanctuary-muted hover:bg-sanctuary-hover hover:text-sanctuary-text"
                >
                  <Archive className="h-4 w-4" />
                  Archive
                </button>
              )}
              <button
                onClick={() => {
                  setShowMenu(false);
                  setDeleteConfirmId(entry.id);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content preview */}
      {previewText && (
        <p className="mt-1 text-sm text-sanctuary-muted line-clamp-2">
          {previewText}
          {hasMore && "..."}
        </p>
      )}

      {/* Emotions row (muted grey badges) */}
      <div className="mt-2">
        <EmotionBadges entryId={entry.id} compact />
      </div>

      {/* Date and archived badge */}
      <div className="mt-1 flex items-center gap-2">
        <time className="text-xs text-sanctuary-muted">
          {formatEntryDate(entry.created_at)}
        </time>
        {entry.is_archived && (
          <span className="text-xs text-sanctuary-muted bg-sanctuary-hover px-1.5 py-0.5 rounded">
            Archived
          </span>
        )}
      </div>
    </div>
  );
}
