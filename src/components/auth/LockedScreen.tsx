import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Lock, Fingerprint } from "lucide-react";

interface LockedScreenProps {
  onUnlock: () => void;
}

export function LockedScreen({ onUnlock }: LockedScreenProps) {
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = async () => {
    setUnlocking(true);
    setError(null);
    try {
      await invoke("unlock");
      onUnlock();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      // User cancelled auth or other error
      if (message.includes("cancelled") || message.includes("cancel")) {
        setError("Authentication cancelled. Tap to try again.");
      } else {
        setError(message);
      }
      setUnlocking(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-sanctuary-bg">
      <button
        onClick={handleUnlock}
        disabled={unlocking}
        className="text-center p-8 rounded-2xl hover:bg-sanctuary-card transition-colors focus:outline-none focus:ring-2 focus:ring-sanctuary-accent focus:ring-offset-2"
      >
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-sanctuary-accent/10">
            {unlocking ? (
              <Fingerprint className="w-12 h-12 text-sanctuary-accent animate-pulse" />
            ) : (
              <Lock className="w-12 h-12 text-sanctuary-accent" />
            )}
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-sanctuary-text mb-2">
          Journal Locked
        </h1>

        <p className="text-sanctuary-muted mb-4">
          {unlocking ? "Authenticating..." : "Tap to unlock with Touch ID"}
        </p>

        {error && (
          <p className="text-red-500 text-sm px-4 py-2 bg-red-50 rounded-md">
            {error}
          </p>
        )}
      </button>
    </div>
  );
}
