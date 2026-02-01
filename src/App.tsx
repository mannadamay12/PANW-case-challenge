import { AppShell } from "./components/layout/AppShell";
import { SetupWizard, wasSetupSkipped } from "./components/setup/SetupWizard";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { IconProvider } from "./components/ui/IconProvider";
import { useModelStatus } from "./hooks/use-ml";

function App() {
  const { data: status, isLoading, refetch } = useModelStatus();

  const modelsReady =
    status?.embedding_downloaded && status?.sentiment_downloaded;
  const needsSetup = !isLoading && !modelsReady && !wasSetupSkipped();

  return (
    <IconProvider>
      <ErrorBoundary>
        {needsSetup && <SetupWizard onComplete={() => refetch()} />}
        <AppShell />
      </ErrorBoundary>
    </IconProvider>
  );
}

export default App;
