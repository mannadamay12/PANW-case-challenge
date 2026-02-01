import { useState, useEffect, useCallback, useRef } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { format } from "date-fns";
import { ArrowLeft, Archive, Trash2, AlertCircle, RotateCcw } from "lucide-react";
import { useEntry, useUpdateEntry, useCreateEntry, useArchiveEntry } from "../../hooks/use-journal";
import { useUIStore } from "../../stores/ui-store";
import { useDebouncedSave } from "../../hooks/use-debounced-save";
import { useSaveOnClose } from "../../hooks/use-save-on-close";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";
import { cn } from "../../lib/utils";

export function Editor() {
  const {
    selectedEntryId,
    isNewEntry,
    closeEditor,
    openEditor,
    setSelectedEntryId,
    setDeleteConfirmId,
  } = useUIStore();

  const { data: entry, isLoading } = useEntry(selectedEntryId);
  const updateMutation = useUpdateEntry();
  const createMutation = useCreateEntry();
  const archiveMutation = useArchiveEntry();

  const [content, setContent] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Track which entry ID we initialized content from to detect entry switches
  const initializedForRef = useRef<string | null | "new">(null);

  // Prevent StrictMode double-create
  const createInFlightRef = useRef(false);

  // Handle save operations with proper entry context
  const handleSaveNew = useCallback(
    async (contentToSave: string) => {
      // Prevent double-create from StrictMode
      if (createInFlightRef.current) return;
      createInFlightRef.current = true;

      try {
        const response = await createMutation.mutateAsync(contentToSave);
        // Switch from "new entry" mode to "editing existing entry" mode
        initializedForRef.current = response.id;
        openEditor(response.id);
        setSaveError(null);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Failed to create entry");
      } finally {
        createInFlightRef.current = false;
      }
    },
    [createMutation, openEditor]
  );

  const handleSaveExisting = useCallback(
    async (entryId: string, contentToSave: string) => {
      try {
        await updateMutation.mutateAsync({ id: entryId, content: contentToSave });
        setSaveError(null);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Failed to save entry");
      }
    },
    [updateMutation]
  );

  const debouncedSave = useDebouncedSave({
    delay: 1000,
    onSaveNew: handleSaveNew,
    onSaveExisting: handleSaveExisting,
  });

  // Handle save on window close
  useSaveOnClose({
    hasPendingChanges: () => debouncedSave.hasPending,
    onFlush: debouncedSave.flushNow,
  });

  // Initialize content when opening an entry or switching entries
  useEffect(() => {
    if (entry) {
      // Only sync content if this is a different entry than we initialized for
      if (initializedForRef.current !== entry.id) {
        // Cancel any pending saves for the previous entry
        debouncedSave.cancel();
        setContent(entry.content);
        initializedForRef.current = entry.id;
        setSaveError(null);
      }
    } else if (isNewEntry) {
      // Only reset for new entry if we weren't already in new entry mode
      if (initializedForRef.current !== "new") {
        debouncedSave.cancel();
        setContent("");
        initializedForRef.current = "new";
        setSaveError(null);
      }
    }
  }, [entry, isNewEntry, debouncedSave]);

  // Reset state when editor is closed
  useEffect(() => {
    if (!selectedEntryId && !isNewEntry) {
      initializedForRef.current = null;
    }
  }, [selectedEntryId, isNewEntry]);

  const handleContentChange = useCallback(
    (value: string) => {
      setContent(value);
      setSaveError(null);

      // Schedule save with current entry context
      debouncedSave.scheduleWrite(value, selectedEntryId, isNewEntry);
    },
    [selectedEntryId, isNewEntry, debouncedSave]
  );

  const handleRetry = useCallback(async () => {
    setSaveError(null);
    await debouncedSave.flushNow();
    // Re-trigger save with current content if flush didn't have pending data
    if (content.trim()) {
      debouncedSave.scheduleWrite(content, selectedEntryId, isNewEntry);
      await debouncedSave.flushNow();
    }
  }, [content, selectedEntryId, isNewEntry, debouncedSave]);

  const handleArchive = () => {
    if (selectedEntryId) {
      archiveMutation.mutate(selectedEntryId, {
        onSuccess: () => {
          closeEditor();
        },
      });
    }
  };

  const handleDelete = () => {
    if (selectedEntryId) {
      setDeleteConfirmId(selectedEntryId);
    }
  };

  const handleBack = async () => {
    // Flush any pending changes before closing
    if (debouncedSave.hasPending) {
      await debouncedSave.flushNow();
    }
    closeEditor();
    setSelectedEntryId(null);
  };

  // Saving indicator
  const isSaving = updateMutation.isPending || createMutation.isPending;

  if (isLoading && selectedEntryId) {
    return (
      <div className="h-full flex flex-col">
        <div className="border-b border-sanctuary-border p-4">
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="flex-1 p-8 max-w-[65ch] mx-auto w-full">
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
      <header className="flex items-center justify-between border-b border-sanctuary-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {entry && (
            <time className="text-sm text-sanctuary-muted">
              {format(new Date(entry.created_at), "EEEE, MMMM d, yyyy")}
            </time>
          )}

          {isNewEntry && (
            <span className="text-sm text-sanctuary-muted">New entry</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Save error */}
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

          {/* Save status */}
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

          {selectedEntryId && !entry?.is_archived && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleArchive}
              disabled={archiveMutation.isPending}
            >
              <Archive className="h-4 w-4 mr-1" />
              Archive
            </Button>
          )}

          {selectedEntryId && (
            <Button variant="ghost" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1 text-red-600" />
              <span className="text-red-600">Delete</span>
            </Button>
          )}
        </div>
      </header>

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[65ch] mx-auto px-4 py-8">
          <TextareaAutosize
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Start writing..."
            minRows={20}
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
    </div>
  );
}
