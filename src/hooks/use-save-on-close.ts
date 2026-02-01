import { useEffect, useRef, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

interface UseSaveOnCloseOptions {
  hasPendingChanges: () => boolean;
  onFlush: () => Promise<void>;
}

/**
 * Handles saving pending changes before the window closes.
 * Intercepts both browser beforeunload and Tauri window close events.
 */
export function useSaveOnClose({ hasPendingChanges, onFlush }: UseSaveOnCloseOptions) {
  const flushRef = useRef(onFlush);
  const hasPendingRef = useRef(hasPendingChanges);

  // Keep refs updated
  useEffect(() => {
    flushRef.current = onFlush;
    hasPendingRef.current = hasPendingChanges;
  }, [onFlush, hasPendingChanges]);

  const handleFlush = useCallback(async () => {
    if (hasPendingRef.current()) {
      await flushRef.current();
    }
  }, []);

  useEffect(() => {
    // Handle browser beforeunload (works for dev and web builds)
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasPendingRef.current()) {
        // Trigger synchronous flush attempt
        // Note: async operations may not complete in beforeunload
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Handle Tauri window close event
    let unlisten: (() => void) | undefined;

    const setupTauriListener = async () => {
      try {
        const appWindow = getCurrentWindow();
        unlisten = await appWindow.onCloseRequested(async (event) => {
          if (hasPendingRef.current()) {
            // Prevent close while we flush
            event.preventDefault();
            try {
              await flushRef.current();
              // Now close the window
              await appWindow.close();
            } catch (error) {
              console.error("Failed to save before close:", error);
              // Allow close anyway to avoid trapping the user
              await appWindow.close();
            }
          }
          // If no pending changes, let the close proceed normally
        });
      } catch (error) {
        // Tauri APIs may not be available in dev/web mode
        console.debug("Tauri window API not available:", error);
      }
    };

    setupTauriListener();

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (unlisten) {
        unlisten();
      }
    };
  }, [handleFlush]);

  return { flush: handleFlush };
}
