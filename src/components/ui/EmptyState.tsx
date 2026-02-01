import { BookOpen } from "lucide-react";
import { cn } from "../../lib/utils";

interface EmptyStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export function EmptyState({
  title = "No entries yet",
  description = "Start writing to capture your thoughts...",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      <div className="rounded-full bg-stone-100 p-4 mb-4">
        <BookOpen className="h-8 w-8 text-sanctuary-muted" />
      </div>
      <h3 className="text-lg font-medium text-sanctuary-text mb-1">{title}</h3>
      <p className="text-sm text-sanctuary-muted max-w-[250px]">{description}</p>
    </div>
  );
}
