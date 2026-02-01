import { useState, useCallback, useRef, useEffect } from "react";

interface UseUndoHistoryOptions {
  maxHistory?: number;
  debounceMs?: number;
}

interface UseUndoHistoryReturn {
  value: string;
  setValue: (newValue: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (newValue: string) => void;
}

export function useUndoHistory(
  initialValue: string = "",
  options: UseUndoHistoryOptions = {}
): UseUndoHistoryReturn {
  const { maxHistory = 50, debounceMs = 300 } = options;

  // History stack: past states
  const [history, setHistory] = useState<string[]>([initialValue]);
  // Current position in history (0 = oldest)
  const [historyIndex, setHistoryIndex] = useState(0);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushedRef = useRef<string>(initialValue);

  const currentValue = history[historyIndex];

  // Push a new value to history (debounced for typing)
  const pushToHistory = useCallback(
    (newValue: string) => {
      if (newValue === lastPushedRef.current) return;

      lastPushedRef.current = newValue;
      setHistory((prev) => {
        // Truncate any "future" states if we're not at the end
        const truncated = prev.slice(0, historyIndex + 1);
        const newHistory = [...truncated, newValue];
        // Limit history size
        if (newHistory.length > maxHistory) {
          return newHistory.slice(newHistory.length - maxHistory);
        }
        return newHistory;
      });
      setHistoryIndex((prev) => {
        const newIndex = Math.min(prev + 1, maxHistory - 1);
        return newIndex;
      });
    },
    [historyIndex, maxHistory]
  );

  const setValue = useCallback(
    (newValue: string) => {
      // Clear any pending debounce
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Update immediate display value by pushing to history after debounce
      // For immediate responsiveness, we update the current position in-place
      // but debounce the actual history push
      setHistory((prev) => {
        const updated = [...prev];
        updated[historyIndex] = newValue;
        return updated;
      });

      // Debounce the history commit
      debounceTimerRef.current = setTimeout(() => {
        pushToHistory(newValue);
      }, debounceMs);
    },
    [historyIndex, debounceMs, pushToHistory]
  );

  const undo = useCallback(() => {
    // Cancel any pending debounce and commit current state
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    setHistoryIndex((prev) => {
      if (prev > 0) {
        lastPushedRef.current = history[prev - 1];
        return prev - 1;
      }
      return prev;
    });
  }, [history]);

  const redo = useCallback(() => {
    setHistoryIndex((prev) => {
      if (prev < history.length - 1) {
        lastPushedRef.current = history[prev + 1];
        return prev + 1;
      }
      return prev;
    });
  }, [history.length]);

  const reset = useCallback((newValue: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setHistory([newValue]);
    setHistoryIndex(0);
    lastPushedRef.current = newValue;
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    value: currentValue,
    setValue,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    reset,
  };
}
