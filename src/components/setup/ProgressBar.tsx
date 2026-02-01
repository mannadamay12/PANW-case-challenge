import { cn } from "../../lib/utils";

interface ProgressBarProps {
  progress: number; // 0-100
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({
  progress,
  className,
  showLabel = true,
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={cn("w-full", className)}>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-sanctuary-border">
        <div
          className="h-full bg-sanctuary-accent transition-all duration-300 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      {showLabel && (
        <p className="mt-2 text-sm text-sanctuary-muted text-center">
          {Math.round(clampedProgress)}%
        </p>
      )}
    </div>
  );
}
