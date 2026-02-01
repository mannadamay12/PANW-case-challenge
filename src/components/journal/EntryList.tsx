import { useEntries, useSearchEntries } from "../../hooks/use-journal";
import { useUIStore } from "../../stores/ui-store";
import { EntryCard } from "./EntryCard";
import { EntryCardSkeleton } from "../ui/Skeleton";
import { EmptyState } from "../ui/EmptyState";
import { groupByRelativeDate } from "../../lib/entry-utils";

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

  const grouped = groupByRelativeDate(entries);

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([dateGroup, groupEntries]) => (
        <div key={dateGroup}>
          <h3 className="text-xs font-medium text-sanctuary-muted uppercase tracking-wider mb-1 px-4">
            {dateGroup}
          </h3>
          <div>
            {groupEntries.map((entry, index) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                isSelected={entry.id === selectedEntryId}
                animationDelay={Math.min(index * 50, 400)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
