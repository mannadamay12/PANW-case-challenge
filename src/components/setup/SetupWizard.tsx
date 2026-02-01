import { useState, useEffect, useRef } from "react";
import { Download, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "../ui/Button";
import { ProgressBar } from "./ProgressBar";
import { useInitializeModels } from "../../hooks/use-ml";
import { cn } from "../../lib/utils";

type WizardStep = "welcome" | "downloading" | "complete" | "error";

const SKIP_STORAGE_KEY = "mindscribe_setup_skipped";

interface SetupWizardProps {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: SetupWizardProps) {
  const [step, setStep] = useState<WizardStep>("welcome");
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const initializeModels = useInitializeModels();

  // Show dialog on mount
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // Simulate progress during download (actual download doesn't report progress)
  useEffect(() => {
    if (step !== "downloading") return;

    // Simulate progress with diminishing increments
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev;
        const remaining = 95 - prev;
        const increment = Math.max(0.5, remaining * 0.03);
        return Math.min(95, prev + increment);
      });
    }, 500);

    return () => clearInterval(interval);
  }, [step]);

  const handleDownload = async () => {
    setStep("downloading");
    setProgress(0);
    setStatusText("Downloading models...");

    try {
      await initializeModels.mutateAsync();
      setProgress(100);
      setStep("complete");
    } catch (error) {
      console.error("Model download failed:", error);
      setStep("error");
    }
  };

  const handleSkip = () => {
    localStorage.setItem(SKIP_STORAGE_KEY, "true");
    dialogRef.current?.close();
    onComplete();
  };

  const handleRetry = () => {
    setStep("welcome");
    setProgress(0);
    setStatusText("");
  };

  const handleComplete = () => {
    localStorage.removeItem(SKIP_STORAGE_KEY);
    dialogRef.current?.close();
    onComplete();
  };

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        "fixed inset-0 z-50 m-auto max-w-md rounded-lg border border-sanctuary-border bg-sanctuary-card p-0 shadow-xl backdrop:bg-black/50",
        "open:animate-in open:fade-in-0 open:zoom-in-95"
      )}
    >
      <div className="p-8">
        {step === "welcome" && (
          <WelcomeStep onDownload={handleDownload} onSkip={handleSkip} />
        )}

        {step === "downloading" && (
          <DownloadingStep progress={progress} statusText={statusText} />
        )}

        {step === "complete" && <CompleteStep onContinue={handleComplete} />}

        {step === "error" && (
          <ErrorStep onRetry={handleRetry} onSkip={handleSkip} />
        )}
      </div>
    </dialog>
  );
}

function WelcomeStep({
  onDownload,
  onSkip,
}: {
  onDownload: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-sanctuary-accent/10">
        <Download className="h-8 w-8 text-sanctuary-accent" />
      </div>

      <h2 className="mb-3 text-xl font-semibold text-sanctuary-text">
        Set Up MindScribe
      </h2>

      <p className="mb-6 text-sanctuary-muted">
        To enable emotion analysis and semantic search, we need to download AI
        models (~350MB).
      </p>

      <p className="mb-8 text-sm text-sanctuary-muted">
        Models run locally — your journal data never leaves your device.
      </p>

      <div className="space-y-3">
        <Button onClick={onDownload} className="w-full">
          Download Models
        </Button>
        <button
          onClick={onSkip}
          className="w-full text-sm text-sanctuary-muted hover:text-sanctuary-text transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

function DownloadingStep({
  progress,
  statusText,
}: {
  progress: number;
  statusText: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center">
        <Loader2 className="h-10 w-10 text-sanctuary-accent animate-spin" />
      </div>

      <h2 className="mb-6 text-xl font-semibold text-sanctuary-text">
        Downloading Models...
      </h2>

      <ProgressBar progress={progress} className="mb-4" />

      <p className="text-sm text-sanctuary-muted">{statusText}</p>

      <p className="mt-4 text-xs text-sanctuary-muted">
        This may take a few minutes depending on your connection.
      </p>
    </div>
  );
}

function CompleteStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <CheckCircle className="h-8 w-8 text-green-600" />
      </div>

      <h2 className="mb-3 text-xl font-semibold text-sanctuary-text">
        Ready to Journal!
      </h2>

      <p className="mb-8 text-sanctuary-muted">
        Your AI models are set up. MindScribe can now analyze emotions and
        search semantically.
      </p>

      <Button onClick={onContinue} className="w-full">
        Start Journaling
      </Button>
    </div>
  );
}

function ErrorStep({
  onRetry,
  onSkip,
}: {
  onRetry: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <AlertCircle className="h-8 w-8 text-red-600" />
      </div>

      <h2 className="mb-3 text-xl font-semibold text-sanctuary-text">
        Download Failed
      </h2>

      <p className="mb-8 text-sanctuary-muted">
        We couldn't download the AI models. Please check your internet
        connection and try again.
      </p>

      <div className="space-y-3">
        <Button onClick={onRetry} className="w-full">
          Try Again
        </Button>
        <button
          onClick={onSkip}
          className="w-full text-sm text-sanctuary-muted hover:text-sanctuary-text transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

// Utility to check if setup was skipped
export function wasSetupSkipped(): boolean {
  return localStorage.getItem(SKIP_STORAGE_KEY) === "true";
}

// Utility to clear skipped status
export function clearSetupSkipped(): void {
  localStorage.removeItem(SKIP_STORAGE_KEY);
}
