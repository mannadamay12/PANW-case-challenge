import { format, isThisMonth, isThisYear, parseISO } from "date-fns";
import { useEntries, useSearchEntries } from "../../hooks/use-journal";
import { useUIStore } from "../../stores/ui-store";
import { EntryCard } from "./EntryCard";
import { EntryCardSkeleton } from "../ui/Skeleton";
import { EmptyState } from "../ui/EmptyState";
import type { JournalEntry } from "../../types/journal";

// Group entries by month
function groupByMonth(entries: JournalEntry[]) {
  const groups: Record<string, JournalEntry[]> = {};

  for (const entry of entries) {
    const date = parseISO(entry.created_at);
    let key: string;

    if (isThisMonth(date)) {
      key = "This Month";
    } else if (isThisYear(date)) {
      key = format(date, "MMMM");
    } else {
      key = format(date, "MMMM yyyy");
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(entry);
  }

  return groups;
}

export function EntryList() {
  const { selectedEntryId, searchQuery, showArchived } = useUIStore();

  // Use search or regular list based on query
  const entriesQuery = useEntries({ archived: showArchived ? true : false });
  const searchResults = useSearchEntries(searchQuery);

  const isSearching = searchQuery.trim().length > 0;
  const query = isSearching ? searchResults : entriesQuery;

  const { data: entries, isLoading, error } = query;

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <EntryCardSkeleton />
        <EntryCardSkeleton />
        <EntryCardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 text-sm">
        Failed to load entries. Please try again.
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <EmptyState
        title={isSearching ? "No results found" : "No entries yet"}
        description={
          isSearching
            ? "Try a different search term"
            : "Start writing to capture your thoughts..."
        }
      />
    );
  }

  const grouped = groupByMonth(entries);

  return (
    <div className="space-y-6 p-4">
      {Object.entries(grouped).map(([month, monthEntries]) => (
        <div key={month}>
          <h3 className="text-xs font-medium text-sanctuary-muted uppercase tracking-wider mb-3">
            {month}
          </h3>
          <div className="space-y-3">
            {monthEntries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                isSelected={entry.id === selectedEntryId}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
