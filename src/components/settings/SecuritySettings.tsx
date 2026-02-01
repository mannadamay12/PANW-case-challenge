import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Fingerprint, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";

interface ProtectionStatus {
  is_enabled: boolean;
  is_unlocked: boolean;
  is_first_launch: boolean;
}

export function SecuritySettings() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const status = await invoke<ProtectionStatus>("check_protection_status");
      setIsEnabled(status.is_enabled);
    } catch (e) {
      console.error("Failed to check protection status:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnable = async () => {
    setIsToggling(true);
    setError(null);
    try {
      await invoke("enable_protection");
      setIsEnabled(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsToggling(false);
    }
  };

  const handleDisable = async () => {
    setShowDisableConfirm(false);
    setIsToggling(true);
    setError(null);
    try {
      await invoke("disable_protection");
      setIsEnabled(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsToggling(false);
    }
  };

  const handleToggle = () => {
    if (isEnabled) {
      setShowDisableConfirm(true);
    } else {
      handleEnable();
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-16 bg-sanctuary-card rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-sanctuary-text">Security</h3>

      <div className="p-4 bg-sanctuary-card rounded-lg border border-sanctuary-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isEnabled ? (
              <ShieldCheck className="h-5 w-5 text-green-600" />
            ) : (
              <ShieldOff className="h-5 w-5 text-sanctuary-muted" />
            )}
            <div>
              <p className="font-medium text-sanctuary-text">
                Touch ID Protection
              </p>
              <p className="text-sm text-sanctuary-muted">
                {isEnabled
                  ? "Your journal is encrypted and protected"
                  : "Enable to encrypt your journal"}
              </p>
            </div>
          </div>

          <Button
            variant={isEnabled ? "secondary" : "primary"}
            size="sm"
            onClick={handleToggle}
            disabled={isToggling}
          >
            <Fingerprint className="h-4 w-4 mr-2" />
            {isToggling ? "..." : isEnabled ? "Disable" : "Enable"}
          </Button>
        </div>

        {error && (
          <p className="text-red-500 text-sm mt-3 px-3 py-2 bg-red-50 rounded">
            {error}
          </p>
        )}
      </div>

      <p className="text-xs text-sanctuary-muted">
        When enabled, your journal entries are encrypted with a key stored in
        macOS Keychain. You'll need to authenticate with Touch ID or your system
        password each time you open MindScribe.
      </p>

      <ConfirmDialog
        isOpen={showDisableConfirm}
        onClose={() => setShowDisableConfirm(false)}
        onConfirm={handleDisable}
        title="Disable Protection?"
        description="This will decrypt your journal and remove the encryption key. Your entries will no longer be protected with Touch ID."
        confirmText="Disable Protection"
        variant="danger"
      />
    </div>
  );
}
