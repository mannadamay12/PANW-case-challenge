import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

export type SummaryPeriod = "weekly" | "monthly";

export interface SummaryResponse {
  summary: string;
  period: string;
  entry_count: number;
}

export interface UseSummaryReturn {
  summary: SummaryResponse | null;
  isGenerating: boolean;
  error: string | null;
  generateSummary: (period: SummaryPeriod) => Promise<void>;
  clearSummary: () => void;
}

/** Hook for generating journal summaries via the LLM. */
export function useSummary(): UseSummaryReturn {
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = useCallback(async (period: SummaryPeriod) => {
    setIsGenerating(true);
    setError(null);
    setSummary(null);

    try {
      const result = await invoke<SummaryResponse>("generate_summary", { period });
      setSummary(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const clearSummary = useCallback(() => {
    setSummary(null);
    setError(null);
  }, []);

  return {
    summary,
    isGenerating,
    error,
    generateSummary,
    clearSummary,
  };
}
