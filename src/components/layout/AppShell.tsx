import { useEffect, useRef } from "react";
import { PanelLeftClose, PanelLeft, Plus } from "lucide-react";
import { useUIStore } from "../../stores/ui-store";
import { useDeleteEntry, useGenerateMissingTitles } from "../../hooks/use-journal";
import { useOllamaStatus } from "../../hooks/use-chat";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { SearchBar } from "../journal/SearchBar";
import { EntryList } from "../journal/EntryList";
import { Editor } from "../journal/Editor";
import { TemplatesView } from "../templates/TemplatesView";
import { Dashboard } from "../dashboard";
import { Titlebar } from "./Titlebar";
import { cn } from "../../lib/utils";
import logoImage from "../../assets/logo.png";

export function AppShell() {
  const {
    isSidebarOpen,
    toggleSidebar,
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
      />

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <aside
          className={cn(
            "flex flex-col border-r border-sanctuary-border bg-sanctuary-bg transition-all duration-300",
            isSidebarOpen ? "w-80" : "w-0 overflow-hidden"
          )}
        >
          {/* Sidebar header */}
          <div className="h-12 flex items-center justify-between px-3 border-b border-sanctuary-border">
            <div className="flex items-center gap-2">
              <img
                src={logoImage}
                alt="MindScribe"
                className="h-6 w-auto"
                title="MindScribe"
              />
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNewEntry}
                title="New entry"
              >
                <Plus className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleSidebar}>
                <PanelLeftClose className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="px-4 py-3">
            <SearchBar />
          </div>

          {/* Entry list */}
          <div className="flex-1 overflow-y-auto">
            <EntryList />
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Collapsed sidebar toggle */}
          {!isSidebarOpen && (
            <div className="h-12 flex items-center px-2 border-b border-sanctuary-border">
              <Button variant="ghost" size="icon" onClick={toggleSidebar}>
                <PanelLeft className="h-5 w-5" />
              </Button>
            </div>
          )}

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
