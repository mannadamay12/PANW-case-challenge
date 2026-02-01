import { useEffect, useRef } from "react";
import { PanelLeftClose, PanelLeft, Plus, Archive, MessageCircle, BookOpen } from "lucide-react";
import { useUIStore } from "../../stores/ui-store";
import { useDeleteEntry, useGenerateMissingTitles } from "../../hooks/use-journal";
import { useOllamaStatus } from "../../hooks/use-chat";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { SearchBar } from "../journal/SearchBar";
import { EntryList } from "../journal/EntryList";
import { Editor } from "../journal/Editor";
import { ChatView } from "../chat/ChatView";
import { cn } from "../../lib/utils";
import logoImage from "../../assets/logo.png";

export function AppShell() {
  const {
    isSidebarOpen,
    toggleSidebar,
    isEditorOpen,
    openEditor,
    closeEditor,
    showArchived,
    toggleShowArchived,
    deleteConfirmId,
    setDeleteConfirmId,
    setSelectedEntryId,
    activeView,
    setActiveView,
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
    <div className="h-screen flex bg-sanctuary-bg">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-r border-sanctuary-border bg-sanctuary-bg transition-all duration-300",
          isSidebarOpen ? "w-80" : "w-0 overflow-hidden"
        )}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-3 border-b border-sanctuary-border">
          <div className="flex items-center gap-2">
            <img
              src={logoImage}
              alt="MindScribe"
              className="h-8 w-auto"
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

        {/* View tabs */}
        <div className="flex border-b border-sanctuary-border">
          <button
            onClick={() => setActiveView("journal")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors",
              activeView === "journal"
                ? "text-sanctuary-accent border-b-2 border-sanctuary-accent"
                : "text-sanctuary-muted hover:text-sanctuary-text"
            )}
          >
            <BookOpen className="h-4 w-4" />
            Journal
          </button>
          <button
            onClick={() => setActiveView("chat")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors",
              activeView === "chat"
                ? "text-sanctuary-accent border-b-2 border-sanctuary-accent"
                : "text-sanctuary-muted hover:text-sanctuary-text"
            )}
          >
            <MessageCircle className="h-4 w-4" />
            Chat
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3">
          <SearchBar />
        </div>

        {/* Filters */}
        <div className="px-4 pb-4">
          <label className="flex items-center gap-2 text-sm text-sanctuary-muted cursor-pointer hover:text-sanctuary-text transition-colors">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={toggleShowArchived}
              className="rounded border-sanctuary-border text-sanctuary-accent focus:ring-sanctuary-accent"
            />
            <Archive className="h-4 w-4" />
            Show archived
          </label>
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
          <div className="p-2 border-b border-sanctuary-border">
            <Button variant="ghost" size="icon" onClick={toggleSidebar}>
              <PanelLeft className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Content area */}
        {activeView === "chat" ? (
          <ChatView />
        ) : isEditorOpen ? (
          <Editor />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sanctuary-muted mb-4">
                Select an entry or create a new one
              </p>
              <Button onClick={handleNewEntry}>
                <Plus className="h-4 w-4 mr-2" />
                New Entry
              </Button>
            </div>
          </div>
        )}
      </main>

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
