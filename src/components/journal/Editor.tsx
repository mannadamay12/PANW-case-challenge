import { useState, useEffect, useCallback, useRef } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { AlertCircle, RotateCcw, Image } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import {
  useEntry,
  useUpdateEntry,
  useCreateEntry,
  useArchiveEntry,
  useGenerateTitle,
} from "../../hooks/use-journal";
import { useUIStore } from "../../stores/ui-store";
import {
  useDebouncedSave,
  SaveData,
  SaveStatus,
} from "../../hooks/use-debounced-save";
import { useSaveOnClose } from "../../hooks/use-save-on-close";
import { useEmbeddingOnSave } from "../../hooks/use-ml";
import { useImageUpload } from "../../hooks/use-image-upload";
import { Button } from "../ui/Button";
import { Skeleton } from "../ui/Skeleton";
import { cn } from "../../lib/utils";
import { WordCount } from "./WordCount";
import { InlineImage } from "./InlineImage";
import { AISidepanel } from "./AISidepanel";
import type { EntryType, EntryImage } from "../../types/journal";

// Font size classes based on preference
const fontSizeClasses = {
  default: "text-lg",
  medium: "text-xl",
  large: "text-2xl",
};

const titleFontSizeClasses = {
  default: "text-2xl",
  medium: "text-3xl",
  large: "text-4xl",
};

export function Editor() {
  const {
    selectedEntryId,
    isNewEntry,
    closeEditor,
    openEditor,
    setDeleteConfirmId,
    pendingTemplateText,
    pendingTemplateTitle,
    clearPendingTemplate,
    editorFontSize,
    showWordCount,
    setEditorContext,
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
  const [_saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [isDragging, setIsDragging] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Track which entry ID we initialized content from
  const initializedForRef = useRef<string | null | "new">(null);
  const createInFlightRef = useRef(false);

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
            onError: (error) => {
              console.error("Failed to generate title:", error);
              // Title generation is non-critical, don't block the user
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
    onStatusChange: setSaveStatus,
  });

  useSaveOnClose({
    hasPendingChanges: () => debouncedSave.hasPending,
    onFlush: debouncedSave.flushNow,
  });

  // Keyboard shortcut: Cmd+S / Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        debouncedSave.flushNow();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [debouncedSave]);

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

  // Insert image markdown at cursor position
  const insertImageMarkdown = useCallback(
    (image: EntryImage) => {
      const markdown = `\n![${image.filename}](${image.relative_path})\n`;
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent =
          content.slice(0, start) + markdown + content.slice(end);
        setContent(newContent);
        setSaveError(null);
        scheduleSave(newContent, title, entryType);
        // Move cursor after the inserted markdown
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd =
            start + markdown.length;
          textarea.focus();
        }, 0);
      } else {
        const newContent = content + markdown;
        setContent(newContent);
        setSaveError(null);
        scheduleSave(newContent, title, entryType);
      }
    },
    [content, title, entryType, scheduleSave]
  );

  const { uploadImage, uploadFromClipboard, isUploading } = useImageUpload({
    entryId: selectedEntryId,
    onUploadComplete: insertImageMarkdown,
    onError: setImageError,
  });

  // Handle image paste
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            setImageError(null);
            uploadFromClipboard(blob);
          }
          return;
        }
      }
    },
    [uploadFromClipboard]
  );

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.types.includes("Files")) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const imageFiles = Array.from(files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (imageFiles.length === 0) return;

      setImageError(null);
      uploadImage(imageFiles[0]);
    },
    [uploadImage]
  );

  // Delete image handler
  const handleDeleteImage = useCallback(
    async (relativePath: string) => {
      if (!selectedEntryId) return;

      try {
        const images = await invoke<EntryImage[]>("get_entry_images", {
          entryId: selectedEntryId,
        });
        const image = images.find((img) => img.relative_path === relativePath);
        if (image) {
          await invoke("delete_entry_image", { imageId: image.id });
          // Remove the markdown from content
          const regex = new RegExp(
            `\\n?!\\[[^\\]]*\\]\\(${relativePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)\\n?`,
            "g"
          );
          const newContent = content.replace(regex, "\n");
          setContent(newContent);
          setSaveError(null);
          scheduleSave(newContent, title, entryType);
        }
      } catch (err) {
        console.error("Failed to delete image:", err);
      }
    },
    [selectedEntryId, content, title, entryType, scheduleSave]
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

  const handleArchive = useCallback(() => {
    if (selectedEntryId) {
      archiveMutation.mutate(selectedEntryId, {
        onSuccess: () => closeEditor(),
      });
    }
  }, [selectedEntryId, archiveMutation, closeEditor]);

  const handleDelete = useCallback(() => {
    if (selectedEntryId) {
      setDeleteConfirmId(selectedEntryId);
    }
  }, [selectedEntryId, setDeleteConfirmId]);

  // Update editor context for titlebar
  useEffect(() => {
    setEditorContext({
      entryId: selectedEntryId,
      entryType,
      isArchived: entry?.is_archived ?? false,
      onChangeEntryType: handleEntryTypeChange,
      onArchive: handleArchive,
      onDelete: handleDelete,
    });

    return () => {
      setEditorContext(null);
    };
  }, [selectedEntryId, entryType, entry?.is_archived, handleEntryTypeChange, handleArchive, handleDelete, setEditorContext]);

  if (isLoading && selectedEntryId) {
    return (
      <div className="h-full flex bg-white">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[65ch] mx-auto px-4 py-8">
              <Skeleton className="h-8 w-2/3 mb-4" />
              <div className="space-y-3">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-11/12" />
                <Skeleton className="h-6 w-4/5" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-3/4" />
              </div>
            </div>
          </div>
        </div>
        <AISidepanel journalId={selectedEntryId} entryContent="" />
      </div>
    );
  }

  return (
    <div className="h-full flex bg-white">
      {/* Main editor area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Editor area */}
        <div
          className={cn(
            "flex-1 overflow-y-auto relative",
            isDragging && "bg-stone-50"
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 flex items-center justify-center bg-stone-50/80 border-2 border-dashed border-stone-300 rounded-lg m-4 z-10">
              <div className="flex flex-col items-center gap-2 text-stone-600">
                <Image className="h-8 w-8" />
                <span className="text-sm font-medium">Drop image here</span>
              </div>
            </div>
          )}

          <div className="max-w-[65ch] mx-auto px-4 py-8">
            {/* Save error inline */}
            {saveError && (
              <div className="mb-4 flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{saveError}</span>
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

            {/* Title field */}
            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Title"
              className={cn(
                "w-full border-0 bg-transparent mb-4",
                "font-serif font-semibold text-sanctuary-text",
                "placeholder:text-sanctuary-muted/50",
                "focus:outline-none",
                titleFontSizeClasses[editorFontSize]
              )}
            />

            {/* Content with inline image rendering */}
            <EditorContent
              content={content}
              onChange={handleContentChange}
              onPaste={handlePaste}
              onDeleteImage={handleDeleteImage}
              textareaRef={textareaRef}
              fontSize={editorFontSize}
            />

            {/* Image upload status */}
            {isUploading && (
              <div className="mt-4 flex items-center gap-2 text-sanctuary-muted text-sm">
                <span className="animate-pulse">Uploading image...</span>
              </div>
            )}

            {imageError && (
              <div className="mt-4 flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{imageError}</span>
              </div>
            )}

            {/* Word count (conditionally shown) */}
            {showWordCount && (
              <div className="mt-8 flex justify-end">
                <WordCount content={content} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Sidepanel */}
      <AISidepanel journalId={selectedEntryId} entryContent={content} />
    </div>
  );
}

// Regex to match markdown image syntax: ![alt](path)
// Non-global version for testing presence, global version for iteration
const HAS_IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/;
const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;

interface EditorContentProps {
  content: string;
  onChange: (value: string) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onDeleteImage: (relativePath: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fontSize: "default" | "medium" | "large";
}

function EditorContent({
  content,
  onChange,
  onPaste,
  onDeleteImage,
  textareaRef,
  fontSize,
}: EditorContentProps) {
  // Check if content has any images (use non-global regex for test)
  const hasImages = HAS_IMAGE_REGEX.test(content);

  if (!hasImages) {
    // No images - render simple textarea
    return (
      <TextareaAutosize
        ref={textareaRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        placeholder="Start writing..."
        minRows={15}
        className={cn(
          "w-full resize-none border-0 bg-transparent",
          "font-serif leading-relaxed text-sanctuary-text",
          "placeholder:text-sanctuary-muted/50",
          "focus:outline-none",
          fontSizeClasses[fontSize]
        )}
        autoFocus
      />
    );
  }

  // Content has images - render mixed content
  // Split content into segments of text and images
  const segments: Array<{ type: "text" | "image"; content: string; alt?: string }> = [];
  let lastIndex = 0;
  let match;

  // Reset global regex state before iteration
  IMAGE_REGEX.lastIndex = 0;
  while ((match = IMAGE_REGEX.exec(content)) !== null) {
    // Add text before the image
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        content: content.slice(lastIndex, match.index),
      });
    }
    // Add the image
    segments.push({
      type: "image",
      content: match[2], // path
      alt: match[1], // alt text
    });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    segments.push({
      type: "text",
      content: content.slice(lastIndex),
    });
  }

  return (
    <div className="space-y-2">
      {segments.map((segment, index) => {
        if (segment.type === "image") {
          return (
            <InlineImage
              key={`${segment.content}-${index}`}
              relativePath={segment.content}
              alt={segment.alt}
              onDelete={() => onDeleteImage(segment.content)}
            />
          );
        }

        // Text segment - use textarea for editing
        const isFirst = index === 0;
        const isLast = index === segments.length - 1;

        return (
          <TextareaAutosize
            key={index}
            ref={isFirst ? textareaRef : undefined}
            value={segment.content}
            onChange={(e) => {
              // Reconstruct full content with updated segment
              const newSegments = [...segments];
              newSegments[index] = { type: "text", content: e.target.value };
              const newContent = newSegments
                .map((s) =>
                  s.type === "image" ? `![${s.alt || ""}](${s.content})` : s.content
                )
                .join("");
              onChange(newContent);
            }}
            onPaste={onPaste}
            placeholder={isFirst ? "Start writing..." : "Continue writing..."}
            minRows={isFirst && segments.length === 1 ? 15 : isLast ? 5 : 1}
            className={cn(
              "w-full resize-none border-0 bg-transparent",
              "font-serif leading-relaxed text-sanctuary-text",
              "placeholder:text-sanctuary-muted/50",
              "focus:outline-none",
              fontSizeClasses[fontSize]
            )}
            autoFocus={isFirst}
          />
        );
      })}
    </div>
  );
}
