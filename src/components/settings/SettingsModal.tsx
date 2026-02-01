import { useEffect, useRef } from "react";
import { X, Settings as SettingsIcon } from "lucide-react";
import { SecuritySettings } from "./SecuritySettings";
import { cn } from "../../lib/utils";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className={cn(
        "fixed inset-0 z-50 m-auto w-full max-w-lg rounded-lg border border-sanctuary-border bg-sanctuary-bg p-0 shadow-xl backdrop:bg-black/50",
        "open:animate-in open:fade-in-0 open:zoom-in-95"
      )}
    >
      <div className="flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sanctuary-border">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-sanctuary-muted" />
            <h2 className="text-lg font-semibold text-sanctuary-text">
              Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-sanctuary-muted hover:text-sanctuary-text transition-colors p-1 rounded hover:bg-sanctuary-card"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <SecuritySettings />
        </div>
      </div>
    </dialog>
  );
}
