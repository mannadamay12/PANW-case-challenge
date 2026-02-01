import { useState, useRef, useCallback } from "react";
import { Sun, Moon, Heart, PenLine, ChevronDown } from "lucide-react";
import type { EntryType } from "../../types/journal";
import { useClickOutside } from "../../hooks/use-click-outside";
import { cn } from "../../lib/utils";

interface EntryTypeSelectorProps {
  value: EntryType;
  onChange: (type: EntryType) => void;
  className?: string;
  compact?: boolean;
}

const entryTypes: { type: EntryType; label: string; icon: typeof Sun }[] = [
  { type: "morning", label: "Morning", icon: Sun },
  { type: "evening", label: "Evening", icon: Moon },
  { type: "gratitude", label: "Gratitude", icon: Heart },
  { type: "reflection", label: "Reflection", icon: PenLine },
];

export function EntryTypeSelector({
  value,
  onChange,
  className = "",
  compact = false,
}: EntryTypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setIsOpen(false), []);
  useClickOutside(ref, closeMenu, isOpen);

  const current = entryTypes.find((t) => t.type === value) ?? entryTypes[3];
  const Icon = current.icon;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 rounded-md transition-colors",
          "text-sanctuary-muted hover:text-sanctuary-text hover:bg-stone-100",
          compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
        )}
      >
        <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        <span>{current.label}</span>
        <ChevronDown
          className={cn(
            "transition-transform",
            compact ? "h-3 w-3" : "h-4 w-4",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-20 w-36 rounded-lg border border-sanctuary-border bg-sanctuary-card py-1 shadow-lg">
          {entryTypes.map(({ type, label, icon: TypeIcon }) => (
            <button
              key={type}
              onClick={() => {
                onChange(type);
                setIsOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
                type === value
                  ? "bg-stone-100 text-sanctuary-text"
                  : "text-sanctuary-muted hover:bg-stone-50 hover:text-sanctuary-text"
              )}
            >
              <TypeIcon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface EntryTypeBadgeProps {
  type: EntryType;
  className?: string;
}

export function EntryTypeBadge({ type, className = "" }: EntryTypeBadgeProps) {
  if (type === "reflection") return null;

  const config = entryTypes.find((t) => t.type === type);
  if (!config) return null;

  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs text-sanctuary-muted",
        className
      )}
    >
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
    </span>
  );
}
