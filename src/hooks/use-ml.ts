import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type {
  EmotionPrediction,
  ModelStatus,
  HybridSearchResult,
  HybridSearchParams,
} from "../types/emotions";
import { useDebounce } from "./use-debounce";

// Query key factory for ML operations
export const mlKeys = {
  all: ["ml"] as const,
  status: () => [...mlKeys.all, "status"] as const,
  emotions: (id: string) => [...mlKeys.all, "emotions", id] as const,
  hybridSearch: (query: string) => [...mlKeys.all, "search", query] as const,
};

// Check if ML models are downloaded and ready
export function useModelStatus() {
  return useQuery({
    queryKey: mlKeys.status(),
    queryFn: async () => {
      return invoke<ModelStatus>("get_model_status");
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

// Initialize/download ML models
export function useInitializeModels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return invoke<void>("initialize_models");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mlKeys.status() });
    },
  });
}

// Get emotions for a journal entry (generates if not cached)
export function useEntryEmotions(id: string | null) {
  const { data: status } = useModelStatus();

  return useQuery({
    queryKey: mlKeys.emotions(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("No entry ID provided");
      return invoke<EmotionPrediction[]>("get_entry_emotions", { id });
    },
    enabled: !!id && !!status?.sentiment_downloaded,
    staleTime: 1000 * 60 * 60, // Cache emotions for 1 hour
    retry: 1,
  });
}

// Hybrid search with FTS5 + vector similarity
export function useHybridSearch(
  query: string,
  params: Omit<HybridSearchParams, "query"> = {}
) {
  const debouncedQuery = useDebounce(query, 300);

  return useQuery({
    queryKey: [...mlKeys.hybridSearch(debouncedQuery), params],
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      return invoke<HybridSearchResult[]>("hybrid_search", {
        query: debouncedQuery,
        limit: params.limit ?? 20,
        includeArchived: params.includeArchived ?? false,
      });
    },
    enabled: debouncedQuery.trim().length > 0,
    // Falls back to FTS-only if embeddings not ready
    staleTime: 1000 * 30, // 30 seconds
  });
}

// Generate embedding for an entry (fire-and-forget, runs in background)
export function useGenerateEmbedding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return invoke<void>("generate_entry_embedding", { id });
    },
    onSuccess: () => {
      // Invalidate search results since new embeddings may affect results
      queryClient.invalidateQueries({
        queryKey: mlKeys.hybridSearch(""),
        exact: false,
      });
    },
  });
}

// Hook to trigger embedding generation after save
export function useEmbeddingOnSave() {
  const generateEmbedding = useGenerateEmbedding();
  const { data: status } = useModelStatus();

  return {
    triggerEmbedding: (id: string) => {
      // Only generate if embedding model is ready
      if (status?.embedding_downloaded) {
        generateEmbedding.mutate(id);
      }
    },
    isReady: !!status?.embedding_downloaded,
  };
}
