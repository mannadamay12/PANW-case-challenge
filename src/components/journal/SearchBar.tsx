import { Search, X } from "lucide-react";
import { useUIStore } from "../../stores/ui-store";
import { cn } from "../../lib/utils";

interface SearchBarProps {
  className?: string;
}

export function SearchBar({ className }: SearchBarProps) {
  const { searchQuery, setSearchQuery } = useUIStore();

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sanctuary-muted" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search entries..."
        className={cn(
          "w-full pl-10 pr-10 py-2 text-sm rounded-lg",
          "border border-sanctuary-border bg-sanctuary-card",
          "placeholder:text-sanctuary-muted text-sanctuary-text",
          "focus:outline-none focus:ring-2 focus:ring-sanctuary-accent focus:border-transparent",
          "transition-shadow"
        )}
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-sanctuary-muted hover:text-sanctuary-text transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
