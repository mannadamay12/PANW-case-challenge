import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { EntryImage } from "../types/journal";

interface UseImageUploadOptions {
  entryId: string | null;
  onUploadComplete: (image: EntryImage) => void;
  onError: (error: string) => void;
}

interface UseImageUploadResult {
  uploadImage: (file: File) => Promise<void>;
  uploadFromClipboard: (blob: Blob, filename?: string) => Promise<void>;
  isUploading: boolean;
}

export function useImageUpload({
  entryId,
  onUploadComplete,
  onError,
}: UseImageUploadOptions): UseImageUploadResult {
  const [isUploading, setIsUploading] = useState(false);

  const uploadBytes = useCallback(
    async (bytes: Uint8Array, filename: string) => {
      if (!entryId) {
        onError("Cannot upload image: entry not saved yet");
        return;
      }

      setIsUploading(true);
      try {
        const image = await invoke<EntryImage>("upload_entry_image", {
          entryId,
          imageData: Array.from(bytes),
          filename,
        });
        onUploadComplete(image);
      } catch (err) {
        onError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsUploading(false);
      }
    },
    [entryId, onUploadComplete, onError]
  );

  const uploadImage = useCallback(
    async (file: File) => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await uploadBytes(bytes, file.name);
    },
    [uploadBytes]
  );

  const uploadFromClipboard = useCallback(
    async (blob: Blob, filename = "pasted-image.png") => {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      await uploadBytes(bytes, filename);
    },
    [uploadBytes]
  );

  return {
    uploadImage,
    uploadFromClipboard,
    isUploading,
  };
}
