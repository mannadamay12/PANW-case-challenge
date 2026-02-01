import { useRef, useCallback, useEffect } from "react";
import type { EntryType } from "../types/journal";

export interface SaveData {
  content: string;
  title?: string;
  entryType?: EntryType;
}

interface PendingWrite {
  data: SaveData;
  entryId: string | null;
  isNewEntry: boolean;
}

interface UseDebouncedSaveOptions {
  delay: number;
  onSaveNew: (data: SaveData) => Promise<string | void>;
  onSaveExisting: (entryId: string, data: SaveData) => Promise<void>;
}

interface UseDebouncedSaveResult {
  scheduleWrite: (data: SaveData, entryId: string | null, isNewEntry: boolean) => void;
  flushNow: () => Promise<void>;
  cancel: () => void;
  hasPending: boolean;
}

/**
 * A debounced save hook that bundles content with the entry ID at typing time.
 * This prevents the race condition where switching entries causes old content
 * to be saved to the new entry.
 */
export function useDebouncedSave({
  delay,
  onSaveNew,
  onSaveExisting,
}: UseDebouncedSaveOptions): UseDebouncedSaveResult {
  const pendingRef = useRef<PendingWrite | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPendingRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const executeSave = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending) return;

    const { data, entryId, isNewEntry } = pending;

    // Clear pending state before async operation
    pendingRef.current = null;
    hasPendingRef.current = false;
    clearTimer();

    // Skip empty content
    if (!data.content.trim()) return;

    try {
      if (isNewEntry) {
        await onSaveNew(data);
      } else if (entryId) {
        await onSaveExisting(entryId, data);
      }
    } catch (error) {
      console.error("Debounced save failed:", error);
      // Error is already handled by the caller's try/catch - don't rethrow
    }
  }, [onSaveNew, onSaveExisting, clearTimer]);

  const scheduleWrite = useCallback(
    (data: SaveData, entryId: string | null, isNewEntry: boolean) => {
      // Capture the entry context at typing time
      pendingRef.current = { data, entryId, isNewEntry };
      hasPendingRef.current = true;

      // Reset the debounce timer
      clearTimer();
      timerRef.current = setTimeout(() => {
        executeSave();
      }, delay);
    },
    [delay, clearTimer, executeSave]
  );

  const flushNow = useCallback(async () => {
    clearTimer();
    await executeSave();
  }, [clearTimer, executeSave]);

  const cancel = useCallback(() => {
    clearTimer();
    pendingRef.current = null;
    hasPendingRef.current = false;
  }, [clearTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    scheduleWrite,
    flushNow,
    cancel,
    get hasPending() {
      return hasPendingRef.current;
    },
  };
}
