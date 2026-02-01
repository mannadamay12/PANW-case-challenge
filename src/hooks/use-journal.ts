import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type {
  JournalEntry,
  CreateEntryResponse,
  DeleteResponse,
  ListEntriesParams,
  CreateEntryParams,
  UpdateEntryParams,
} from "../types/journal";
import { useDebounce } from "./use-debounce";

// Query key factory
export const journalKeys = {
  all: ["entries"] as const,
  lists: () => [...journalKeys.all, "list"] as const,
  list: (params: ListEntriesParams) => [...journalKeys.lists(), params] as const,
  details: () => [...journalKeys.all, "detail"] as const,
  detail: (id: string) => [...journalKeys.details(), id] as const,
  search: (query: string, includeArchived = false) =>
    [...journalKeys.all, "search", query, { includeArchived }] as const,
  stats: () => [...journalKeys.all, "stats"] as const,
};

// Stats types
export interface JournalStats {
  total_entries: number;
  streak_days: number;
  entries_this_week: number;
  entries_this_month: number;
}

// Get journal statistics for dashboard
export function useJournalStats() {
  return useQuery({
    queryKey: journalKeys.stats(),
    queryFn: async () => {
      return invoke<JournalStats>("get_journal_stats");
    },
    refetchOnWindowFocus: true,
  });
}

// List entries with optional filters
export function useEntries(params: ListEntriesParams = {}) {
  return useQuery({
    queryKey: journalKeys.list(params),
    queryFn: async () => {
      return invoke<JournalEntry[]>("list_entries", {
        limit: params.limit ?? 50,
        offset: params.offset ?? 0,
        archived: params.archived,
      });
    },
  });
}

// Get single entry
export function useEntry(id: string | null) {
  return useQuery({
    queryKey: journalKeys.detail(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("No entry ID provided");
      return invoke<JournalEntry>("get_entry", { id });
    },
    enabled: !!id,
  });
}

// Search entries (with debounced query support)
export function useSearchEntries(query: string, includeArchived = false) {
  const debouncedQuery = useDebounce(query, 300);

  return useQuery({
    queryKey: journalKeys.search(debouncedQuery, includeArchived),
    queryFn: async () => {
      if (!debouncedQuery.trim()) return [];
      return invoke<JournalEntry[]>("search_entries", {
        query: debouncedQuery,
        includeArchived,
      });
    },
    enabled: debouncedQuery.trim().length > 0,
  });
}

// Create entry mutation
export function useCreateEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateEntryParams | string) => {
      // Support both legacy string param and new object param
      const { content, title, entry_type } =
        typeof params === "string" ? { content: params, title: undefined, entry_type: undefined } : params;
      // Tauri v2 converts camelCase (JS) to snake_case (Rust) automatically
      return invoke<CreateEntryResponse>("create_entry", {
        content,
        title,
        entryType: entry_type,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: journalKeys.all });
    },
  });
}

// Update entry mutation with optimistic updates
export function useUpdateEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateEntryParams) => {
      // Tauri v2 converts camelCase (JS) to snake_case (Rust) automatically
      return invoke<JournalEntry>("update_entry", {
        id: params.id,
        content: params.content,
        title: params.title,
        entryType: params.entry_type,
        createdAt: params.created_at,
      });
    },
    onMutate: async (params) => {
      const { id, content, title, entry_type, created_at } = params;
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: journalKeys.detail(id) });

      // Snapshot previous value
      const previousEntry = queryClient.getQueryData<JournalEntry>(
        journalKeys.detail(id)
      );

      // Optimistically update
      if (previousEntry) {
        queryClient.setQueryData<JournalEntry>(journalKeys.detail(id), {
          ...previousEntry,
          ...(content !== undefined && { content }),
          ...(title !== undefined && { title }),
          ...(entry_type !== undefined && { entry_type }),
          ...(created_at !== undefined && { created_at }),
          updated_at: new Date().toISOString(),
        });
      }

      return { previousEntry };
    },
    onError: (_err, { id }, context) => {
      // Rollback on error
      if (context?.previousEntry) {
        queryClient.setQueryData(journalKeys.detail(id), context.previousEntry);
      }
    },
    onSettled: (_data, _err, { id }) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: journalKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: journalKeys.lists() });
    },
  });
}

// Delete entry mutation
export function useDeleteEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return invoke<DeleteResponse>("delete_entry", { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: journalKeys.all });
    },
  });
}

// Archive entry mutation
export function useArchiveEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return invoke<JournalEntry>("archive_entry", { id });
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: journalKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: journalKeys.lists() });
    },
  });
}

// Unarchive entry mutation
export function useUnarchiveEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return invoke<JournalEntry>("unarchive_entry", { id });
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: journalKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: journalKeys.lists() });
    },
  });
}

// Generate title using LLM
export function useGenerateTitle() {
  return useMutation({
    mutationFn: async (content: string) => {
      return invoke<string>("generate_title", { content });
    },
  });
}

// Generate titles for all entries that don't have one
export function useGenerateMissingTitles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return invoke<number>("generate_missing_titles");
    },
    onSuccess: (count) => {
      if (count > 0) {
        // Refresh the entry list to show new titles
        queryClient.invalidateQueries({ queryKey: journalKeys.all });
      }
    },
  });
}
