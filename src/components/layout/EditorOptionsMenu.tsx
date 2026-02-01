import { useState, useRef, useEffect } from "react";
import {
  Gear,
  Check,
  SquaresFour,
  FloppyDisk,
  Archive,
  Trash,
  Eye,
  Calendar,
} from "@phosphor-icons/react";
import { useUIStore } from "../../stores/ui-store";
import { cn } from "../../lib/utils";
import { DatePicker } from "../ui/DatePicker";

interface EditorOptionsMenuProps {
  entryId: string | null;
  entryDate?: string | null;
  onChangeDate?: (date: string) => void;
  isArchived?: boolean;
  onOpenGallery: () => void;
  onSaveAsTemplate?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

export function EditorOptionsMenu({
  entryId,
  entryDate,
  onChangeDate,
  isArchived = false,
  onOpenGallery,
  onSaveAsTemplate,
  onArchive,
  onDelete,
}: EditorOptionsMenuProps) {
  const {
    showWordCount,
    toggleShowWordCount,
    showTitle,
    toggleShowTitle,
    showArchived,
    toggleShowArchived,
  } = useUIStore();

  const [isOpen, setIsOpen] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowDatePicker(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1 p-1.5 rounded-md",
          "text-sanctuary-muted hover:text-sanctuary-text hover:bg-sanctuary-hover",
          "transition-colors"
        )}
        title="Options"
      >
        <Gear className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-40 w-48 rounded-lg border border-sanctuary-border bg-sanctuary-card py-1 shadow-lg animate-scale-in origin-top-right">
          {/* Show Title toggle */}
          <button
            onClick={() => toggleShowTitle()}
            className={cn(
              "flex w-full items-center justify-between px-3 py-2 text-sm",
              "text-sanctuary-muted hover:bg-sanctuary-hover hover:text-sanctuary-text"
            )}
          >
            <span>Show Title</span>
            {showTitle && <Check className="h-4 w-4" />}
          </button>

          {/* Show Word Count toggle */}
          <button
            onClick={() => toggleShowWordCount()}
            className={cn(
              "flex w-full items-center justify-between px-3 py-2 text-sm",
              "text-sanctuary-muted hover:bg-sanctuary-hover hover:text-sanctuary-text"
            )}
          >
            <span>Show Word Count</span>
            {showWordCount && <Check className="h-4 w-4" />}
          </button>

          {/* Change Date */}
          {entryId && entryDate && onChangeDate && (
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-sm",
                  "text-sanctuary-muted hover:bg-sanctuary-hover hover:text-sanctuary-text"
                )}
              >
                <Calendar className="h-4 w-4" />
                <span>Change Date</span>
              </button>
              {showDatePicker && (
                <DatePicker
                  value={entryDate}
                  onChange={(date) => {
                    onChangeDate(date);
                    setShowDatePicker(false);
                    setIsOpen(false);
                  }}
                  onClose={() => setShowDatePicker(false)}
                />
              )}
            </div>
          )}

          <div className="my-1 border-t border-sanctuary-border" />

          {/* Gallery */}
          <button
            onClick={() => {
              onOpenGallery();
              setIsOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-sm",
              "text-sanctuary-muted hover:bg-sanctuary-hover hover:text-sanctuary-text"
            )}
          >
            <SquaresFour className="h-4 w-4" />
            <span>Gallery</span>
          </button>

          {/* Save as Template */}
          {onSaveAsTemplate && entryId && (
            <button
              onClick={() => {
                onSaveAsTemplate();
                setIsOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-sm",
                "text-sanctuary-muted hover:bg-sanctuary-hover hover:text-sanctuary-text"
              )}
            >
              <FloppyDisk className="h-4 w-4" />
              <span>Save as Template</span>
            </button>
          )}

          {/* Show Archived toggle */}
          <button
            onClick={() => toggleShowArchived()}
            className={cn(
              "flex w-full items-center justify-between px-3 py-2 text-sm",
              "text-sanctuary-muted hover:bg-sanctuary-hover hover:text-sanctuary-text"
            )}
          >
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <span>Show Archived</span>
            </div>
            {showArchived && <Check className="h-4 w-4" />}
          </button>

          {entryId && (onArchive || onDelete) && (
            <>
              <div className="my-1 border-t border-sanctuary-border" />

              {/* Archive */}
              {onArchive && !isArchived && (
                <button
                  onClick={() => {
                    onArchive();
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm",
                    "text-sanctuary-muted hover:bg-sanctuary-hover hover:text-sanctuary-text"
                  )}
                >
                  <Archive className="h-4 w-4" />
                  <span>Archive</span>
                </button>
              )}

              {/* Delete */}
              {onDelete && (
                <button
                  onClick={() => {
                    onDelete();
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm",
                    "text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  )}
                >
                  <Trash className="h-4 w-4" />
                  <span>Delete</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
