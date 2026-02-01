import { format } from "date-fns";
import { Archive, MoreHorizontal, Trash2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { JournalEntry } from "../../types/journal";
import { useArchiveEntry } from "../../hooks/use-journal";
import { useUIStore } from "../../stores/ui-store";
import { cn } from "../../lib/utils";
import { EmotionBadges } from "./EmotionBadges";

interface EntryCardProps {
  entry: JournalEntry;
  isSelected?: boolean;
}

export function EntryCard({ entry, isSelected }: EntryCardProps) {
  const { setSelectedEntryId, openEditor, setDeleteConfirmId } = useUIStore();
  const archiveMutation = useArchiveEntry();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
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

  // Extract preview text (first ~100 chars, first line)
  const previewText = entry.content.split("\n")[0].slice(0, 100);
  const hasMore = entry.content.length > 100 || entry.content.includes("\n");

  return (
    <div
      onClick={handleClick}
      className={cn(
        "group relative rounded-lg border bg-sanctuary-card p-4 cursor-pointer transition-all",
        "hover:shadow-md hover:border-stone-300",
        isSelected
          ? "border-sanctuary-accent ring-1 ring-sanctuary-accent"
          : "border-sanctuary-border",
        entry.is_archived && "opacity-60"
      )}
    >
      {/* Date */}
      <time className="text-xs text-sanctuary-muted">
        {format(new Date(entry.created_at), "EEE, MMM d")}
      </time>

      {/* Content preview */}
      <p className="mt-2 font-serif text-sanctuary-text line-clamp-3">
        {previewText}
        {hasMore && "..."}
      </p>

      {/* Emotion badges */}
      <EmotionBadges entryId={entry.id} className="mt-2" />

      {/* Actions menu */}
      <div
        ref={menuRef}
        className="absolute top-3 right-3"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setShowMenu(!showMenu)}
          className={cn(
            "p-1.5 rounded text-sanctuary-muted transition-colors",
            "opacity-0 group-hover:opacity-100 focus:opacity-100",
            "hover:bg-stone-100 hover:text-sanctuary-text"
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {showMenu && (
          <div className="absolute right-0 top-8 z-10 w-36 rounded-lg border border-sanctuary-border bg-sanctuary-card py-1 shadow-lg">
            {!entry.is_archived && (
              <button
                onClick={() => {
                  setShowMenu(false);
                  archiveMutation.mutate(entry.id);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-sanctuary-muted hover:bg-stone-100 hover:text-sanctuary-text"
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
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Archived badge */}
      {entry.is_archived && (
        <span className="absolute top-3 right-12 text-xs text-sanctuary-muted bg-stone-100 px-2 py-0.5 rounded">
          Archived
        </span>
      )}
    </div>
  );
}
