import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Fingerprint, ShieldOff } from "lucide-react";
import { Button } from "../ui/Button";

interface ProtectionSetupProps {
  onComplete: () => void;
}

export function ProtectionSetup({ onComplete }: ProtectionSetupProps) {
  const [enabling, setEnabling] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnable = async () => {
    setEnabling(true);
    setError(null);
    try {
      await invoke("enable_protection");
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEnabling(false);
    }
  };

  const handleSkip = async () => {
    setSkipping(true);
    setError(null);
    try {
      await invoke("skip_protection");
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSkipping(false);
    }
  };

  const isLoading = enabling || skipping;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-sanctuary-bg">
      <div className="max-w-md p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 rounded-full bg-sanctuary-accent/10">
            <Fingerprint className="w-12 h-12 text-sanctuary-accent" />
          </div>
        </div>

        <h1 className="text-2xl font-semibold text-sanctuary-text mb-3">
          Protect your journal with Touch ID?
        </h1>

        <p className="text-sanctuary-muted mb-8">
          Your entries will be encrypted and only accessible with your
          fingerprint or system password.
        </p>

        {error && (
          <p className="text-red-500 text-sm mb-4 px-4 py-2 bg-red-50 rounded-md">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <Button
            onClick={handleEnable}
            disabled={isLoading}
            className="w-full"
          >
            <Fingerprint className="h-4 w-4 mr-2" />
            {enabling ? "Enabling..." : "Enable Touch ID"}
          </Button>

          <Button
            variant="ghost"
            onClick={handleSkip}
            disabled={isLoading}
            className="w-full"
          >
            <ShieldOff className="h-4 w-4 mr-2" />
            {skipping ? "..." : "Skip for now"}
          </Button>
        </div>

        <p className="text-xs text-sanctuary-muted mt-6">
          You can enable protection later in Settings.
        </p>
      </div>
    </div>
  );
}
