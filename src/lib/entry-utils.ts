import {
  parseISO,
  isToday,
  isYesterday,
  isThisWeek,
  isThisMonth,
  isThisYear,
  format,
} from "date-fns";
import type { JournalEntry } from "../types/journal";

type DateGroup = {
  label: string;
  sortOrder: number;
};

/**
 * Get the relative date group for a date.
 * Returns both label and sort order for proper grouping.
 */
function getDateGroup(date: Date): DateGroup {
  if (isToday(date)) {
    return { label: "Today", sortOrder: 0 };
  }
  if (isYesterday(date)) {
    return { label: "Yesterday", sortOrder: 1 };
  }
  if (isThisWeek(date, { weekStartsOn: 0 })) {
    return { label: "This Week", sortOrder: 2 };
  }
  if (isThisMonth(date)) {
    return { label: "This Month", sortOrder: 3 };
  }
  if (isThisYear(date)) {
    return { label: format(date, "MMMM"), sortOrder: 4 };
  }
  return { label: format(date, "MMMM yyyy"), sortOrder: 5 };
}

/**
 * Group entries by relative date (Today, Yesterday, This Week, etc.)
 * Returns entries sorted by date within each group.
 */
export function groupByRelativeDate(
  entries: JournalEntry[]
): Record<string, JournalEntry[]> {
  const groups: Record<string, { entries: JournalEntry[]; sortOrder: number }> =
    {};

  for (const entry of entries) {
    const date = parseISO(entry.created_at);
    const { label, sortOrder } = getDateGroup(date);

    if (!groups[label]) {
      groups[label] = { entries: [], sortOrder };
    }
    groups[label].entries.push(entry);
  }

  // Sort groups by their sort order and return as plain Record
  const sortedKeys = Object.keys(groups).sort(
    (a, b) => groups[a].sortOrder - groups[b].sortOrder
  );

  const result: Record<string, JournalEntry[]> = {};
  for (const key of sortedKeys) {
    // Entries are already sorted by created_at DESC from the backend
    result[key] = groups[key].entries;
  }

  return result;
}

/**
 * Derive a title from content if no title is provided.
 * Uses the first line, truncated to ~50 chars.
 */
export function deriveTitle(content: string): string {
  const firstLine = content.split("\n")[0].trim();
  if (firstLine.length <= 50) {
    return firstLine || "Untitled";
  }
  // Find a good break point
  const breakPoint = firstLine.lastIndexOf(" ", 50);
  if (breakPoint > 30) {
    return firstLine.slice(0, breakPoint) + "...";
  }
  return firstLine.slice(0, 47) + "...";
}

/**
 * Format date for display in entry card.
 */
export function formatEntryDate(dateString: string): string {
  const date = parseISO(dateString);
  if (isToday(date)) {
    return format(date, "h:mm a");
  }
  if (isYesterday(date)) {
    return "Yesterday";
  }
  if (isThisYear(date)) {
    return format(date, "EEE, MMM d");
  }
  return format(date, "MMM d, yyyy");
}

/**
 * Format date for display in editor header.
 */
export function formatEditorDate(dateString: string): string {
  const date = parseISO(dateString);
  return format(date, "EEEE, MMMM d, yyyy");
}
