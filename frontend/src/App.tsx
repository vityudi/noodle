import { useEffect, useState } from "react";
import { setupApi, type SetupStatus } from "@/lib/api";
import { SetupWizard } from "@/components/setup/SetupWizard";

type AppState = "loading" | "setup" | "ready";

export default function App() {
  const [state, setState] = useState<AppState>("loading");

  useEffect(() => {
    setupApi.status()
      .then((status: SetupStatus) => setState(status.complete ? "ready" : "setup"))
      .catch(() => setState("setup"));
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500 text-sm">Loading…</div>
      </div>
    );
  }

  if (state === "setup") {
    return <SetupWizard onComplete={() => setState("ready")} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">🍜 Noodle</h1>
        <p className="mt-3 text-zinc-400">Visual MCP server builder</p>
      </div>
    </div>
  );
}
