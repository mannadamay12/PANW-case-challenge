import { useState, useRef, useEffect } from "react";
import {
  Settings,
  Sun,
  Moon,
  Heart,
  PenLine,
  Check,
  BookTemplate,
  Save,
  Archive,
  Trash2,
  Eye,
  ChevronRight,
} from "lucide-react";
import { useUIStore } from "../../stores/ui-store";
import { cn } from "../../lib/utils";
import type { EntryType } from "../../types/journal";

interface EditorOptionsMenuProps {
  entryId: string | null;
  entryType: EntryType;
  onChangeEntryType: (type: EntryType) => void;
  isArchived?: boolean;
  onOpenLibrary: () => void;
  onSaveAsTemplate?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

const entryTypes: { type: EntryType; label: string; icon: typeof Sun }[] = [
  { type: "morning", label: "Morning", icon: Sun },
  { type: "evening", label: "Evening", icon: Moon },
  { type: "gratitude", label: "Gratitude", icon: Heart },
  { type: "reflection", label: "Reflection", icon: PenLine },
];

export function EditorOptionsMenu({
  entryId,
  entryType,
  onChangeEntryType,
  isArchived = false,
  onOpenLibrary,
  onSaveAsTemplate,
  onArchive,
  onDelete,
}: EditorOptionsMenuProps) {
  const {
    showWordCount,
    toggleShowWordCount,
    showArchived,
    toggleShowArchived,
  } = useUIStore();

  const [isOpen, setIsOpen] = useState(false);
  const [showEntryTypeSubmenu, setShowEntryTypeSubmenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowEntryTypeSubmenu(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const currentType = entryTypes.find((t) => t.type === entryType) ?? entryTypes[3];

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
        <Settings className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-lg border border-sanctuary-border bg-sanctuary-card py-1 shadow-lg">
          {/* Entry Type with submenu */}
          <div
            className="relative"
            onMouseEnter={() => setShowEntryTypeSubmenu(true)}
            onMouseLeave={() => setShowEntryTypeSubmenu(false)}
          >
            <button
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-sm",
                "text-sanctuary-muted hover:bg-sanctuary-hover hover:text-sanctuary-text"
              )}
            >
              <div className="flex items-center gap-2">
                <currentType.icon className="h-4 w-4" />
                <span>Entry Type</span>
              </div>
              <ChevronRight className="h-4 w-4" />
            </button>

            {showEntryTypeSubmenu && (
              <div className="absolute left-full top-0 ml-1 w-36 rounded-lg border border-sanctuary-border bg-sanctuary-card py-1 shadow-lg">
                {entryTypes.map(({ type, label, icon: Icon }) => (
                  <button
                    key={type}
                    onClick={() => {
                      onChangeEntryType(type);
                      setShowEntryTypeSubmenu(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-sm transition-colors",
                      type === entryType
                        ? "bg-sanctuary-selected text-sanctuary-text"
                        : "text-sanctuary-muted hover:bg-sanctuary-hover hover:text-sanctuary-text"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </div>
                    {type === entryType && <Check className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="my-1 border-t border-sanctuary-border" />

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

          <div className="my-1 border-t border-sanctuary-border" />

          {/* Library */}
          <button
            onClick={() => {
              onOpenLibrary();
              setIsOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-sm",
              "text-sanctuary-muted hover:bg-sanctuary-hover hover:text-sanctuary-text"
            )}
          >
            <BookTemplate className="h-4 w-4" />
            <span>Library</span>
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
              <Save className="h-4 w-4" />
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
                  <Trash2 className="h-4 w-4" />
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
