import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { JournalEntry } from "../types/journal";

// Types matching Rust structs
export interface StreakInfo {
  current_streak: number;
  longest_streak: number;
  last_entry_date: string | null;
  entries_this_week: string[];
}

export interface DayEmotions {
  date: string;
  dominant_emotion: string | null;
  entry_count: number;
}

// Query key factory
export const dashboardKeys = {
  all: ["dashboard"] as const,
  streak: () => [...dashboardKeys.all, "streak"] as const,
  emotions: (startDate: string, endDate: string) =>
    [...dashboardKeys.all, "emotions", startDate, endDate] as const,
  onThisDay: () => [...dashboardKeys.all, "onThisDay"] as const,
};

/** Get extended streak information. */
export function useStreakInfo() {
  return useQuery({
    queryKey: dashboardKeys.streak(),
    queryFn: () => invoke<StreakInfo>("get_streak_info"),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/** Get emotion trends for a date range. */
export function useEmotionTrends(startDate: string, endDate: string) {
  return useQuery({
    queryKey: dashboardKeys.emotions(startDate, endDate),
    queryFn: () =>
      invoke<DayEmotions[]>("get_emotion_trends", {
        startDate,
        endDate,
      }),
    staleTime: 5 * 60 * 1000,
    enabled: !!startDate && !!endDate,
  });
}

/** Get entries from the same date in previous years. */
export function useOnThisDay() {
  return useQuery({
    queryKey: dashboardKeys.onThisDay(),
    queryFn: () => invoke<JournalEntry[]>("get_on_this_day"),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}
