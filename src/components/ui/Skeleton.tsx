import { cn } from "../../lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-shimmer rounded-md", className)}
    />
  );
}

export function EntryCardSkeleton() {
  return (
    <div className="rounded-lg border border-sanctuary-border bg-sanctuary-card p-4 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}
