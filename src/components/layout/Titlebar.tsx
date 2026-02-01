import { Plus, SidebarSimple, MagicWand, X } from "@phosphor-icons/react";
import { FontSizeMenu } from "./FontSizeMenu";
import { EditorOptionsMenu } from "./EditorOptionsMenu";
import { useUIStore } from "../../stores/ui-store";
import { cn } from "../../lib/utils";

const iconButtonClass = cn(
  "flex items-center justify-center p-1.5 rounded-md cursor-pointer",
  "text-sanctuary-muted hover:text-sanctuary-text hover:bg-sanctuary-hover",
  "transition-colors"
);

interface TitlebarProps {
  entryId: string | null;
  entryDate?: string | null;
  onChangeDate?: (date: string) => void;
  isArchived?: boolean;
  onArchive?: () => void;
  onDelete?: () => void;
  onNewEntry: () => void;
}

export function Titlebar({
  entryId,
  entryDate,
  onChangeDate,
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
    closeEditor,
  } = useUIStore();

  const handleOpenGallery = () => {
    setActiveView("library");
  };

  // Format: "Saturday, Feb 1" - use entry date if available, otherwise today
  const dateFormatOptions: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "short",
    day: "numeric",
  };
  const displayDate = entryDate
    ? new Date(entryDate).toLocaleDateString("en-US", dateFormatOptions)
    : new Date().toLocaleDateString("en-US", dateFormatOptions);

  return (
    <header
      data-tauri-drag-region
      className="titlebar-drag-region h-[38px] flex items-center justify-between bg-sanctuary-bg border-b border-sanctuary-border flex-shrink-0"
    >
      {/* Left section: Traffic lights space + Close/New entry + Sidebar toggle */}
      <div className="flex items-center gap-1 pl-[70px]">
        {isEditorOpen ? (
          <button
            onClick={closeEditor}
            title="Close entry"
            className={cn(iconButtonClass, "titlebar-no-drag")}
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={onNewEntry}
            title="New entry"
            className={cn(iconButtonClass, "titlebar-no-drag")}
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={toggleSidebar}
          title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          className={cn(iconButtonClass, "titlebar-no-drag")}
        >
          <SidebarSimple className="h-4 w-4" weight={isSidebarOpen ? "fill" : "regular"} />
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
          {isEditorOpen ? displayDate : "MindScribe"}
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
          <MagicWand className="h-4 w-4" />
        </button>
        <div className="titlebar-no-drag">
          <FontSizeMenu />
        </div>
        <div className="titlebar-no-drag">
          <EditorOptionsMenu
            entryId={entryId}
            entryDate={entryDate}
            onChangeDate={onChangeDate}
            isArchived={isArchived}
            onOpenGallery={handleOpenGallery}
            onArchive={onArchive}
            onDelete={onDelete}
          />
        </div>
      </div>
    </header>
  );
}
