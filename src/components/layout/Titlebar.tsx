import { FontSizeMenu } from "./FontSizeMenu";
import { EditorOptionsMenu } from "./EditorOptionsMenu";
import { useUIStore } from "../../stores/ui-store";
import type { EntryType } from "../../types/journal";

interface TitlebarProps {
  entryId: string | null;
  entryType: EntryType;
  onChangeEntryType: (type: EntryType) => void;
  isArchived?: boolean;
  onArchive?: () => void;
  onDelete?: () => void;
}

export function Titlebar({
  entryId,
  entryType,
  onChangeEntryType,
  isArchived = false,
  onArchive,
  onDelete,
}: TitlebarProps) {
  const { setActiveView } = useUIStore();

  const handleOpenLibrary = () => {
    setActiveView("library");
  };

  return (
    <header
      data-tauri-drag-region
      className="h-[38px] flex items-center justify-between pl-[70px] pr-4 bg-sanctuary-bg border-b border-sanctuary-border flex-shrink-0"
    >
      <span
        data-tauri-drag-region
        className="text-sm font-medium text-sanctuary-text select-none"
      >
        MindScribe
      </span>
      <div className="flex items-center gap-1">
        <FontSizeMenu />
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
    </header>
  );
}
