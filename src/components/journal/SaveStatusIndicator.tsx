import { useState, useEffect, useRef } from "react";
import { CircleNotch, CheckCircle } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import type { SaveStatus } from "../../hooks/use-debounced-save";

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  className?: string;
}

export function SaveStatusIndicator({
  status,
  className,
}: SaveStatusIndicatorProps) {
  const [showPulse, setShowPulse] = useState(false);
  const prevStatus = useRef(status);

  useEffect(() => {
    if (prevStatus.current !== "saved" && status === "saved") {
      setShowPulse(true);
      const timer = setTimeout(() => setShowPulse(false), 300);
      return () => clearTimeout(timer);
    }
    prevStatus.current = status;
  }, [status]);

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs transition-opacity duration-200",
        status === "idle" && "text-sanctuary-muted opacity-50",
        status === "pending" && "text-sanctuary-muted",
        status === "saving" && "text-sanctuary-muted",
        status === "saved" && "text-green-600",
        status === "error" && "text-red-600",
        className
      )}
    >
      {status === "saving" && (
        <>
          <CircleNotch className="h-3 w-3 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <CheckCircle className={cn("h-3 w-3", showPulse && "animate-subtle-pulse")} />
          <span>Saved</span>
        </>
      )}
      {status === "pending" && <span>Unsaved</span>}
      {status === "idle" && <span>Saved</span>}
      {status === "error" && <span>Save failed</span>}
    </div>
  );
}
