import { Calendar, CaretRight } from "@phosphor-icons/react";
import { parseISO, format, differenceInYears } from "date-fns";
import { Skeleton } from "../ui/Skeleton";
import { deriveTitle } from "../../lib/entry-utils";
import type { JournalEntry } from "../../types/journal";

interface OnThisDayProps {
  entries: JournalEntry[];
  isLoading?: boolean;
  onOpenEntry: (entryId: string) => void;
}

export function OnThisDay({ entries, isLoading, onOpenEntry }: OnThisDayProps) {
  if (isLoading) {
    return <OnThisDaySkeleton />;
  }

  if (!entries || entries.length === 0) {
    return null; // Don't show the card if there are no historical entries
  }

  const entry = entries[0]; // Show the most recent historical entry
  const entryDate = parseISO(entry.created_at);
  const yearsAgo = differenceInYears(new Date(), entryDate);
  const title = entry.title || deriveTitle(entry.content);
  const preview = entry.content.slice(0, 120);

  return (
    <div className="bg-sanctuary-card border border-sanctuary-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-4 w-4 text-sanctuary-accent" />
        <h3 className="text-sm font-medium text-sanctuary-text">On This Day</h3>
        <span className="text-xs text-sanctuary-muted">
          {yearsAgo} {yearsAgo === 1 ? "year" : "years"} ago
        </span>
      </div>

      <button
        onClick={() => onOpenEntry(entry.id)}
        className="w-full text-left group"
      >
        <div className="space-y-2">
          <h4 className="font-medium text-sanctuary-text group-hover:text-sanctuary-accent transition-colors line-clamp-1">
            {title}
          </h4>
          <p className="text-sm text-sanctuary-muted line-clamp-2">{preview}</p>
          <div className="flex items-center justify-between pt-2">
            <time className="text-xs text-sanctuary-muted">
              {format(entryDate, "MMMM d, yyyy")}
            </time>
            <span className="text-xs text-sanctuary-accent flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              Read full entry
              <CaretRight className="h-3 w-3" />
            </span>
          </div>
        </div>
      </button>

      {entries.length > 1 && (
        <p className="text-xs text-sanctuary-muted mt-3 pt-3 border-t border-sanctuary-border">
          +{entries.length - 1} more{" "}
          {entries.length - 1 === 1 ? "entry" : "entries"} from this date
        </p>
      )}
    </div>
  );
}

function OnThisDaySkeleton() {
  return (
    <div className="bg-sanctuary-card border border-sanctuary-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="pt-2">
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </div>
  );
}
