import { WarningCircle, X } from "@phosphor-icons/react";
import { useChatStore } from "../../stores/chat-store";

export function DistressBanner() {
  const safetyWarning = useChatStore((state) => state.safetyWarning);
  const setSafetyWarning = useChatStore((state) => state.setSafetyWarning);

  // Only show for distress level (soft warning)
  if (!safetyWarning || safetyWarning.level !== "distress") {
    return null;
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-3">
      <div className="flex items-start gap-3 max-w-3xl mx-auto">
        <WarningCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {safetyWarning.intervention}
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            If you need support, the 988 Lifeline is available 24/7.
          </p>
        </div>
        <button
          onClick={() => setSafetyWarning(null)}
          className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
