import { AppShell } from "./components/layout/AppShell";
import { AuthGuard } from "./components/auth";
import { SetupWizard, wasSetupSkipped } from "./components/setup/SetupWizard";
import { useModelStatus } from "./hooks/use-ml";

function AppContent() {
  const { data: status, isLoading, refetch } = useModelStatus();

  const modelsReady =
    status?.embedding_downloaded && status?.sentiment_downloaded;
  const needsSetup = !isLoading && !modelsReady && !wasSetupSkipped();

  return (
    <>
      {needsSetup && <SetupWizard onComplete={() => refetch()} />}
      <AppShell />
    </>
  );
}

function App() {
  return (
    <AuthGuard>
      <AppContent />
    </AuthGuard>
  );
}

export default App;
