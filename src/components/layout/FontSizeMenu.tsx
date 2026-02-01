import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useUIStore, type EditorFontSize } from "../../stores/ui-store";
import { cn } from "../../lib/utils";

const fontSizes: { size: EditorFontSize; label: string }[] = [
  { size: "default", label: "Default" },
  { size: "medium", label: "Medium" },
  { size: "large", label: "Large" },
];

export function FontSizeMenu() {
  const { editorFontSize, setEditorFontSize } = useUIStore();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium",
          "text-sanctuary-muted hover:text-sanctuary-text hover:bg-stone-100",
          "transition-colors"
        )}
      >
        <span className="text-xs">AA</span>
        <ChevronDown
          className={cn("h-3 w-3 transition-transform", isOpen && "rotate-180")}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-32 rounded-lg border border-sanctuary-border bg-sanctuary-card py-1 shadow-lg">
          {fontSizes.map(({ size, label }) => (
            <button
              key={size}
              onClick={() => {
                setEditorFontSize(size);
                setIsOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-sm transition-colors",
                size === editorFontSize
                  ? "bg-stone-100 text-sanctuary-text"
                  : "text-sanctuary-muted hover:bg-stone-50 hover:text-sanctuary-text"
              )}
            >
              <span>{label}</span>
              {size === editorFontSize && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
