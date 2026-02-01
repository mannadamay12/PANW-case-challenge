import { useState, useEffect, useCallback, useRef } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { Menu, Archive, Trash2, AlertCircle, RotateCcw } from "lucide-react";
import {
  useEntry,
  useUpdateEntry,
  useCreateEntry,
  useArchiveEntry,
  useGenerateTitle,
} from "../../hooks/use-journal";
import { useUIStore } from "../../stores/ui-store";
import { useDebouncedSave, SaveData } from "../../hooks/use-debounced-save";
import { useSaveOnClose } from "../../hooks/use-save-on-close";
import { useEmbeddingOnSave } from "../../hooks/use-ml";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";
import { cn } from "../../lib/utils";
import { WordCount } from "./WordCount";
import { EntryTypeSelector } from "./EntryTypeSelector";
import { formatEditorDate } from "../../lib/entry-utils";
import type { EntryType } from "../../types/journal";

export function Editor() {
  const {
    selectedEntryId,
    isNewEntry,
    closeEditor,
    openEditor,
    setDeleteConfirmId,
    toggleSidebar,
    isSidebarOpen,
    pendingTemplateText,
    pendingTemplateTitle,
    clearPendingTemplate,
  } = useUIStore();

  const { data: entry, isLoading } = useEntry(selectedEntryId);
  const updateMutation = useUpdateEntry();
  const createMutation = useCreateEntry();
  const archiveMutation = useArchiveEntry();
  const generateTitleMutation = useGenerateTitle();
  const { triggerEmbedding } = useEmbeddingOnSave();

  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [entryType, setEntryType] = useState<EntryType>("reflection");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Track which entry ID we initialized content from
  const initializedForRef = useRef<string | null | "new">(null);
  const createInFlightRef = useRef(false);

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

  const handleSaveNew = useCallback(
    async (data: SaveData) => {
      if (createInFlightRef.current) return;
      createInFlightRef.current = true;

      try {
        const response = await createMutation.mutateAsync({
          content: data.content,
          title: data.title,
          entry_type: data.entryType,
        });
        initializedForRef.current = response.id;
        openEditor(response.id);
        setSaveError(null);
        triggerEmbedding(response.id);

        // Generate title if not set
        if (!data.title && data.content.trim().length > 20) {
          generateTitleMutation.mutate(data.content, {
            onSuccess: (generatedTitle) => {
              if (generatedTitle) {
                setTitle(generatedTitle);
                updateMutation.mutate({
                  id: response.id,
                  title: generatedTitle,
                });
              }
            },
          });
        }
      } catch (error) {
        setSaveError(
          error instanceof Error ? error.message : "Failed to create entry"
        );
      } finally {
        createInFlightRef.current = false;
      }
    },
    [createMutation, openEditor, triggerEmbedding, generateTitleMutation, updateMutation]
  );

  const handleSaveExisting = useCallback(
    async (entryId: string, data: SaveData) => {
      try {
        await updateMutation.mutateAsync({
          id: entryId,
          content: data.content,
          title: data.title,
          entry_type: data.entryType,
        });
        setSaveError(null);
        triggerEmbedding(entryId);
      } catch (error) {
        setSaveError(
          error instanceof Error ? error.message : "Failed to save entry"
        );
      }
    },
    [updateMutation, triggerEmbedding]
  );

  const debouncedSave = useDebouncedSave({
    delay: 1000,
    onSaveNew: handleSaveNew,
    onSaveExisting: handleSaveExisting,
  });

  useSaveOnClose({
    hasPendingChanges: () => debouncedSave.hasPending,
    onFlush: debouncedSave.flushNow,
  });

  // Initialize when opening an entry
  useEffect(() => {
    if (entry) {
      if (initializedForRef.current !== entry.id) {
        debouncedSave.flushNow();
        setContent(entry.content);
        setTitle(entry.title || "");
        setEntryType(entry.entry_type);
        initializedForRef.current = entry.id;
        setSaveError(null);
      }
    } else if (isNewEntry) {
      if (initializedForRef.current !== "new") {
        debouncedSave.flushNow();
        // Use pending template data if available
        setContent(pendingTemplateText || "");
        setTitle(pendingTemplateTitle || "");
        setEntryType("reflection");
        initializedForRef.current = "new";
        setSaveError(null);
        // Clear pending template after use
        if (pendingTemplateText || pendingTemplateTitle) {
          clearPendingTemplate();
        }
      }
    }
  }, [entry, isNewEntry, debouncedSave, pendingTemplateText, pendingTemplateTitle, clearPendingTemplate]);

  useEffect(() => {
    if (!selectedEntryId && !isNewEntry) {
      initializedForRef.current = null;
    }
  }, [selectedEntryId, isNewEntry]);

  const scheduleSave = useCallback(
    (newContent: string, newTitle: string, newEntryType: EntryType) => {
      debouncedSave.scheduleWrite(
        { content: newContent, title: newTitle || undefined, entryType: newEntryType },
        selectedEntryId,
        isNewEntry
      );
    },
    [selectedEntryId, isNewEntry, debouncedSave]
  );

  const handleContentChange = useCallback(
    (value: string) => {
      setContent(value);
      setSaveError(null);
      scheduleSave(value, title, entryType);
    },
    [title, entryType, scheduleSave]
  );

  const handleTitleChange = useCallback(
    (value: string) => {
      setTitle(value);
      setSaveError(null);
      scheduleSave(content, value, entryType);
    },
    [content, entryType, scheduleSave]
  );

  const handleEntryTypeChange = useCallback(
    (type: EntryType) => {
      setEntryType(type);
      setSaveError(null);
      scheduleSave(content, title, type);
    },
    [content, title, scheduleSave]
  );

  const handleRetry = useCallback(async () => {
    setSaveError(null);
    await debouncedSave.flushNow();
    if (content.trim()) {
      scheduleSave(content, title, entryType);
      await debouncedSave.flushNow();
    }
  }, [content, title, entryType, debouncedSave, scheduleSave]);

  const handleArchive = () => {
    if (selectedEntryId) {
      archiveMutation.mutate(selectedEntryId, {
        onSuccess: () => closeEditor(),
      });
    }
  };

  const handleDelete = () => {
    if (selectedEntryId) {
      setDeleteConfirmId(selectedEntryId);
    }
  };

  const isSaving = updateMutation.isPending || createMutation.isPending;

  if (isLoading && selectedEntryId) {
    return (
      <div className="h-full flex flex-col">
        <div className="border-b border-sanctuary-border p-4">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="flex-1 p-8 max-w-[65ch] mx-auto w-full">
          <Skeleton className="h-8 w-2/3 mb-6" />
          <Skeleton className="h-6 w-full mb-4" />
          <Skeleton className="h-6 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-sanctuary-border px-4 py-2">
        <div className="flex items-center gap-2">
          {!isSidebarOpen && (
            <Button variant="ghost" size="icon" onClick={toggleSidebar}>
              <Menu className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Center: Date and entry type */}
        <div className="flex items-center gap-3">
          {entry && (
            <time className="text-sm text-sanctuary-muted">
              {formatEditorDate(entry.created_at)}
            </time>
          )}
          {isNewEntry && (
            <span className="text-sm text-sanctuary-muted">New entry</span>
          )}
          <EntryTypeSelector
            value={entryType}
            onChange={handleEntryTypeChange}
            compact
          />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {saveError && (
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-xs">{saveError}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRetry}
                className="text-red-600 hover:text-red-700"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            </div>
          )}

          {!saveError && (
            <span
              className={cn(
                "text-xs transition-opacity",
                isSaving ? "text-sanctuary-muted" : "text-transparent"
              )}
            >
              Saving...
            </span>
          )}

          {/* Menu button for archive/delete */}
          {selectedEntryId && (
            <div ref={menuRef} className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMenu(!showMenu)}
              >
                <Menu className="h-5 w-5" />
              </Button>

              {showMenu && (
                <div className="absolute right-0 top-10 z-10 w-36 rounded-lg border border-sanctuary-border bg-sanctuary-card py-1 shadow-lg">
                  {!entry?.is_archived && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        handleArchive();
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
                      handleDelete();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[65ch] mx-auto px-4 py-8">
          {/* Title field */}
          <input
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Title"
            className={cn(
              "w-full border-0 bg-transparent mb-4",
              "font-serif text-2xl font-semibold text-sanctuary-text",
              "placeholder:text-sanctuary-muted/50",
              "focus:outline-none"
            )}
          />

          {/* Content */}
          <TextareaAutosize
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Start writing..."
            minRows={15}
            className={cn(
              "w-full resize-none border-0 bg-transparent",
              "font-serif text-lg leading-relaxed text-sanctuary-text",
              "placeholder:text-sanctuary-muted/50",
              "focus:outline-none"
            )}
            autoFocus
          />
        </div>
      </div>

      {/* Footer with word count */}
      <footer className="border-t border-sanctuary-border px-4 py-2 flex justify-end">
        <WordCount content={content} />
      </footer>
    </div>
  );
}
