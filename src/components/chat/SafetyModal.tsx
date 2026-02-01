import { useEffect, useRef } from "react";
import { Heart, Phone, X } from "@phosphor-icons/react";
import { Button } from "../ui/Button";
import { useChatStore } from "../../stores/chat-store";
import { cn } from "../../lib/utils";
import { useAnimatedPresence } from "../../hooks/use-animated-presence";

export function SafetyModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const safetyWarning = useChatStore((state) => state.safetyWarning);
  const showSafetyModal = useChatStore((state) => state.showSafetyModal);
  const setShowSafetyModal = useChatStore((state) => state.setShowSafetyModal);
  const setSafetyWarning = useChatStore((state) => state.setSafetyWarning);

  const isOpen = showSafetyModal && safetyWarning?.level === "crisis";
  const { shouldRender, isAnimating } = useAnimatedPresence(isOpen, 150);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (shouldRender) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [shouldRender]);

  const handleClose = () => {
    setShowSafetyModal(false);
    setSafetyWarning(null);
  };

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      handleClose();
    }
  };

  if (!shouldRender) return null;

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className={cn(
        "fixed inset-0 z-50 m-auto max-w-lg rounded-xl border border-sanctuary-border bg-sanctuary-card p-0 shadow-xl backdrop:bg-black/60",
        isAnimating ? "animate-scale-in" : "animate-scale-out"
      )}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 rounded-full bg-red-100 dark:bg-red-950/50">
            <Heart className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-sanctuary-text mb-1">
              We Care About You
            </h2>
            <p className="text-sanctuary-muted">
              It sounds like you might be going through a really difficult time.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-sanctuary-muted hover:text-sanctuary-text transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Resources */}
        <div className="space-y-4 mb-6">
          <p className="text-sanctuary-text">
            Your wellbeing matters. Please consider reaching out to someone who can help:
          </p>

          <div className="space-y-3">
            <a
              href="tel:988"
              className="flex items-center gap-3 p-4 rounded-lg bg-sanctuary-bg border border-sanctuary-border hover:border-sanctuary-accent transition-colors"
            >
              <Phone className="h-5 w-5 text-sanctuary-accent" />
              <div>
                <div className="font-medium text-sanctuary-text">
                  988 Suicide & Crisis Lifeline
                </div>
                <div className="text-sm text-sanctuary-muted">
                  Call or text 988 - Available 24/7
                </div>
              </div>
            </a>

            <a
              href="sms:741741?body=HOME"
              className="flex items-center gap-3 p-4 rounded-lg bg-sanctuary-bg border border-sanctuary-border hover:border-sanctuary-accent transition-colors"
            >
              <Phone className="h-5 w-5 text-sanctuary-accent" />
              <div>
                <div className="font-medium text-sanctuary-text">
                  Crisis Text Line
                </div>
                <div className="text-sm text-sanctuary-muted">
                  Text HOME to 741741
                </div>
              </div>
            </a>
          </div>

          <p className="text-sm text-sanctuary-muted">
            These services are free, confidential, and available 24/7. You don't have to face this alone.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end">
          <Button onClick={handleClose} variant="secondary">
            I Understand
          </Button>
        </div>
      </div>
    </dialog>
  );
}
