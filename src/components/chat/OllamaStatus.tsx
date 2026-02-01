import { WarningCircle, CheckCircle, CircleNotch } from "@phosphor-icons/react";
import { useOllamaStatus } from "../../hooks/use-chat";

export function OllamaStatusIndicator() {
  const { data: status, isLoading, error } = useOllamaStatus();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sanctuary-muted text-sm">
        <CircleNotch className="h-4 w-4 animate-spin" />
        <span>Checking AI status...</span>
      </div>
    );
  }

  if (error || !status?.is_running) {
    return (
      <div className="flex items-center gap-2 text-amber-600 text-sm">
        <WarningCircle className="h-4 w-4" />
        <span>Ollama not running</span>
      </div>
    );
  }

  if (!status.model_available) {
    return (
      <div className="flex items-center gap-2 text-amber-600 text-sm">
        <WarningCircle className="h-4 w-4" />
        <span>Model not installed</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-green-600 text-sm">
      <CheckCircle className="h-4 w-4" />
      <span>AI Ready</span>
    </div>
  );
}

export function OllamaSetupBanner() {
  const { data: status, isLoading } = useOllamaStatus();

  if (isLoading) return null;

  // All good, don't show banner
  if (status?.is_running && status?.model_available) {
    return null;
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start gap-3">
          <WarningCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {!status?.is_running
                ? "Ollama is not running"
                : "Chat model not installed"}
            </p>
            <p className="text-xs text-amber-700 mt-1">
              {!status?.is_running ? (
                <>
                  Start Ollama to enable chat. Run:{" "}
                  <code className="bg-amber-100 px-1 rounded">ollama serve</code>
                </>
              ) : (
                <>
                  Install the chat model:{" "}
                  <code className="bg-amber-100 px-1 rounded">
                    ollama pull {status?.model_name}
                  </code>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
