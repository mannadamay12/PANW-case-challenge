import { useState, useEffect, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ProtectionSetup } from "./ProtectionSetup";
import { LockedScreen } from "./LockedScreen";

interface ProtectionStatus {
  is_enabled: boolean;
  is_unlocked: boolean;
  is_first_launch: boolean;
}

type AuthState = "loading" | "setup" | "locked" | "unlocked";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const [authState, setAuthState] = useState<AuthState>("loading");

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const status = await invoke<ProtectionStatus>("check_protection_status");

      if (status.is_unlocked) {
        // Already unlocked (shouldn't happen on fresh start, but handle it)
        setAuthState("unlocked");
      } else if (status.is_first_launch) {
        // First launch - show protection setup prompt
        setAuthState("setup");
      } else if (status.is_enabled) {
        // Protection enabled but not unlocked - need to authenticate
        setAuthState("locked");
      } else {
        // Protection not enabled, initialize unencrypted DB
        await invoke("skip_protection");
        setAuthState("unlocked");
      }
    } catch (e) {
      console.error("Failed to check protection status:", e);
      // On error, try to initialize unencrypted
      try {
        await invoke("skip_protection");
        setAuthState("unlocked");
      } catch {
        // Show setup as fallback
        setAuthState("setup");
      }
    }
  };

  if (authState === "loading") {
    return <SplashScreen />;
  }

  if (authState === "setup") {
    return <ProtectionSetup onComplete={() => setAuthState("unlocked")} />;
  }

  if (authState === "locked") {
    return <LockedScreen onUnlock={() => setAuthState("unlocked")} />;
  }

  return <>{children}</>;
}

function SplashScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-sanctuary-bg">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-sanctuary-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sanctuary-muted">Loading...</p>
      </div>
    </div>
  );
}
