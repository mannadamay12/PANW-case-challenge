import { AppShell } from "./components/layout/AppShell";
import { SetupWizard, wasSetupSkipped } from "./components/setup/SetupWizard";
import { useModelStatus } from "./hooks/use-ml";

function App() {
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

export default App;
