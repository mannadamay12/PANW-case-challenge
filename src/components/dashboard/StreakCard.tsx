import { Flame, Trophy } from "@phosphor-icons/react";
import { Skeleton } from "../ui/Skeleton";
import { cn } from "../../lib/utils";

interface StreakCardProps {
  currentStreak: number;
  longestStreak: number;
  isLoading?: boolean;
}

export function StreakCard({
  currentStreak,
  longestStreak,
  isLoading,
}: StreakCardProps) {
  const isOnFire = currentStreak >= 7;
  const isRecord = currentStreak === longestStreak && currentStreak > 0;

  if (isLoading) {
    return <StreakCardSkeleton />;
  }

  return (
    <div
      className={cn(
        "bg-sanctuary-card border border-sanctuary-border rounded-xl p-5",
        isOnFire && "ring-2 ring-orange-400/50 border-orange-400/30"
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "text-4xl font-bold",
                isOnFire ? "text-orange-500" : "text-sanctuary-text"
              )}
            >
              {currentStreak}
            </span>
            <span className="text-sanctuary-muted text-sm">
              {currentStreak === 1 ? "day" : "days"}
            </span>
          </div>
          <p className="text-sm text-sanctuary-muted mt-1">Current streak</p>
        </div>

        <div
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center",
            isOnFire
              ? "bg-orange-500/20"
              : "bg-sanctuary-accent/10"
          )}
        >
          <Flame
            className={cn(
              "h-7 w-7",
              isOnFire
                ? "text-orange-500"
                : currentStreak > 0
                  ? "text-sanctuary-accent"
                  : "text-sanctuary-muted"
            )}
          />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-sanctuary-border flex items-center gap-2 text-sm text-sanctuary-muted">
        <Trophy className="h-4 w-4" />
        <span>
          Longest: <strong className="text-sanctuary-text">{longestStreak}</strong>{" "}
          {longestStreak === 1 ? "day" : "days"}
        </span>
        {isRecord && currentStreak > 1 && (
          <span className="text-orange-500 font-medium">Personal best!</span>
        )}
      </div>
    </div>
  );
}

function StreakCardSkeleton() {
  return (
    <div className="bg-sanctuary-card border border-sanctuary-border rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-14 w-14 rounded-full" />
      </div>
      <div className="mt-4 pt-3 border-t border-sanctuary-border">
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}
