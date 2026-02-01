import { useState } from "react";
import {
  Sparkle,
  CalendarDots,
  Calendar,
  X,
  SpinnerGap,
  Copy,
  Check,
  WarningCircle,
} from "@phosphor-icons/react";
import { Button } from "../ui/Button";
import { useSummary, type SummaryPeriod } from "../../hooks/use-summary";
import { cn } from "../../lib/utils";

export function SummaryCard() {
  const { summary, isGenerating, error, generateSummary, clearSummary } = useSummary();
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (period: SummaryPeriod) => {
    await generateSummary(period);
  };

  const handleCopy = async () => {
    if (summary?.summary) {
      await navigator.clipboard.writeText(summary.summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Show summary result
  if (summary) {
    const periodLabel = summary.period === "monthly" ? "Monthly" : "Weekly";
    return (
      <div className="bg-sanctuary-card border border-sanctuary-border rounded-xl p-5 animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Sparkle className="h-6 w-6 text-sanctuary-text" weight="fill" />
            <div>
              <h3 className="text-sm font-medium text-sanctuary-text">
                {periodLabel} Reflection
              </h3>
              <p className="text-xs text-sanctuary-muted">
                Based on {summary.entry_count} {summary.entry_count === 1 ? "entry" : "entries"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              className="h-8 w-8"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearSummary}
              className="h-8 w-8"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="prose prose-sm text-sanctuary-text leading-relaxed whitespace-pre-wrap">
          {summary.summary}
        </div>

        <div className="mt-4 pt-3 border-t border-sanctuary-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSummary}
            className="text-sanctuary-muted"
          >
            Generate another
          </Button>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="bg-sanctuary-card border border-sanctuary-border rounded-xl p-5 animate-fade-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
            <WarningCircle className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-sanctuary-text">
              Summary Generation Failed
            </h3>
            <p className="text-xs text-sanctuary-muted mt-0.5">
              {error.includes("Ollama")
                ? "Make sure Ollama is running with the Gemma model."
                : "Something went wrong. Please try again."}
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={clearSummary}>
          Try Again
        </Button>
      </div>
    );
  }

  // Show loading state
  if (isGenerating) {
    return (
      <div className="bg-sanctuary-card border border-sanctuary-border rounded-xl p-5 animate-fade-up">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sanctuary-accent/10 flex items-center justify-center">
            <SpinnerGap className="h-5 w-5 text-sanctuary-accent animate-spin" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-sanctuary-text">
              Generating your reflection...
            </h3>
            <p className="text-xs text-sanctuary-muted mt-0.5">
              This may take a moment
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Default: show generate buttons
  return (
    <div className="bg-sanctuary-card border border-sanctuary-border rounded-xl p-5 animate-fade-up">
      <div className="flex items-center gap-3 mb-4">
        <Sparkle className="h-6 w-6 text-sanctuary-text" weight="fill" />
        <div>
          <h3 className="text-xs font-medium text-sanctuary-muted uppercase tracking-wider">At a Glance</h3>
          <p className="text-xs text-sanctuary-muted mt-1">
            Get insights from your journal entries
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <SummaryButton
          label="Weekly Summary"
          icon={<CalendarDots className="h-4 w-4" />}
          onClick={() => handleGenerate("weekly")}
        />
        <SummaryButton
          label="Monthly Summary"
          icon={<Calendar className="h-4 w-4" />}
          onClick={() => handleGenerate("monthly")}
        />
      </div>
    </div>
  );
}

interface SummaryButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

function SummaryButton({ label, icon, onClick }: SummaryButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer",
        "bg-sanctuary-hover border border-sanctuary-border",
        "text-sanctuary-text hover:bg-sanctuary-accent/10 hover:border-sanctuary-accent/30",
        "transition-all active:scale-[0.98]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
