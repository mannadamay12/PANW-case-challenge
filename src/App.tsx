import { AppShell } from "./components/layout/AppShell";
import { SetupWizard, wasSetupSkipped } from "./components/setup/SetupWizard";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { useModelStatus } from "./hooks/use-ml";

function App() {
  const { data: status, isLoading, refetch } = useModelStatus();

  const modelsReady =
    status?.embedding_downloaded && status?.sentiment_downloaded;
  const needsSetup = !isLoading && !modelsReady && !wasSetupSkipped();

  return (
    <ErrorBoundary>
      {needsSetup && <SetupWizard onComplete={() => refetch()} />}
      <AppShell />
    </ErrorBoundary>
  );
}

export default App;
