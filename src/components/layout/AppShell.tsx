import { useEffect, useRef } from "react";
import { useUIStore } from "../../stores/ui-store";
import { useDeleteEntry, useGenerateMissingTitles } from "../../hooks/use-journal";
import { useOllamaStatus } from "../../hooks/use-chat";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { EntryList } from "../journal/EntryList";
import { Editor } from "../journal/Editor";
import { TemplatesView } from "../templates/TemplatesView";
import { Dashboard } from "../dashboard";
import { Titlebar } from "./Titlebar";
import { cn } from "../../lib/utils";

export function AppShell() {
  const {
    isSidebarOpen,
    isEditorOpen,
    openEditor,
    closeEditor,
    deleteConfirmId,
    setDeleteConfirmId,
    setSelectedEntryId,
    activeView,
    editorContext,
  } = useUIStore();

  const deleteMutation = useDeleteEntry();
  const generateMissingTitles = useGenerateMissingTitles();
  const { data: ollamaStatus } = useOllamaStatus();
  const titleGenTriggeredRef = useRef(false);

  // Generate titles for existing entries without them (once on startup)
  useEffect(() => {
    if (
      ollamaStatus?.is_running &&
      ollamaStatus?.model_available &&
      !titleGenTriggeredRef.current &&
      !generateMissingTitles.isPending
    ) {
      titleGenTriggeredRef.current = true;
      generateMissingTitles.mutate();
    }
  }, [ollamaStatus, generateMissingTitles]);

  const handleNewEntry = () => {
    openEditor();
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmId) {
      deleteMutation.mutate(deleteConfirmId, {
        onSuccess: () => {
          setDeleteConfirmId(null);
          setSelectedEntryId(null);
          closeEditor();
        },
      });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-sanctuary-bg">
      {/* Global Titlebar */}
      <Titlebar
        entryId={editorContext?.entryId ?? null}
        entryType={editorContext?.entryType ?? "reflection"}
        onChangeEntryType={editorContext?.onChangeEntryType ?? (() => {})}
        isArchived={editorContext?.isArchived}
        onArchive={editorContext?.onArchive}
        onDelete={editorContext?.onDelete}
        onNewEntry={handleNewEntry}
      />

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar - just the entry list, no header */}
        <aside
          className={cn(
            "flex flex-col border-r border-sanctuary-border bg-sanctuary-bg transition-all duration-300",
            isSidebarOpen ? "w-80" : "w-0 overflow-hidden"
          )}
        >
          <div className="flex-1 overflow-y-auto pt-2">
            <EntryList />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Content area */}
          {activeView === "library" ? (
            <TemplatesView />
          ) : isEditorOpen ? (
            <Editor />
          ) : (
            <Dashboard />
          )}
        </main>
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Entry"
        description="Are you sure you want to delete this entry? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
