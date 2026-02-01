import { Plus, PanelLeft, PanelLeftClose, Wand2 } from "lucide-react";
import { FontSizeMenu } from "./FontSizeMenu";
import { EditorOptionsMenu } from "./EditorOptionsMenu";
import { useUIStore } from "../../stores/ui-store";
import { cn } from "../../lib/utils";
import type { EntryType } from "../../types/journal";

const iconButtonClass = cn(
  "flex items-center justify-center p-1.5 rounded-md",
  "text-sanctuary-muted hover:text-sanctuary-text hover:bg-sanctuary-hover",
  "transition-colors"
);

interface TitlebarProps {
  entryId: string | null;
  entryType: EntryType;
  onChangeEntryType: (type: EntryType) => void;
  isArchived?: boolean;
  onArchive?: () => void;
  onDelete?: () => void;
  onNewEntry: () => void;
}

export function Titlebar({
  entryId,
  entryType,
  onChangeEntryType,
  isArchived = false,
  onArchive,
  onDelete,
  onNewEntry,
}: TitlebarProps) {
  const {
    setActiveView,
    isSidebarOpen,
    toggleSidebar,
    isAIPanelOpen,
    toggleAIPanel,
    isEditorOpen,
  } = useUIStore();

  const handleOpenLibrary = () => {
    setActiveView("library");
  };

  // Format: "Saturday, Feb 1"
  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  return (
    <header
      data-tauri-drag-region
      className="titlebar-drag-region h-[38px] flex items-center justify-between bg-sanctuary-bg border-b border-sanctuary-border flex-shrink-0"
    >
      {/* Left section: Traffic lights space + New entry + Sidebar toggle */}
      <div className="flex items-center gap-1 pl-[70px]">
        <button
          onClick={onNewEntry}
          title="New entry"
          className={cn(iconButtonClass, "titlebar-no-drag")}
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          onClick={toggleSidebar}
          title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          className={cn(iconButtonClass, "titlebar-no-drag")}
        >
          {isSidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Center section: Date when editor open, app name otherwise */}
      <div
        data-tauri-drag-region
        className="flex-1 flex justify-center items-center"
      >
        <span
          data-tauri-drag-region
          className="text-sm text-sanctuary-muted select-none"
        >
          {isEditorOpen ? currentDate : "MindScribe"}
        </span>
      </div>

      {/* Right section: AI Companion + Font Size + Settings */}
      <div className="flex items-center gap-1 pr-3">
        <button
          onClick={toggleAIPanel}
          title="AI Companion"
          className={cn(
            iconButtonClass,
            "titlebar-no-drag",
            isAIPanelOpen && "bg-sanctuary-hover text-sanctuary-text"
          )}
        >
          <Wand2 className="h-4 w-4" />
        </button>
        <div className="titlebar-no-drag">
          <FontSizeMenu />
        </div>
        <div className="titlebar-no-drag">
          <EditorOptionsMenu
            entryId={entryId}
            entryType={entryType}
            onChangeEntryType={onChangeEntryType}
            isArchived={isArchived}
            onOpenLibrary={handleOpenLibrary}
            onArchive={onArchive}
            onDelete={onDelete}
          />
        </div>
      </div>
    </header>
  );
}
