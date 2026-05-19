import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setupApi, type Project, type SetupStatus } from "@/lib/api";
import { SetupWizard } from "@/components/setup/SetupWizard";
import { LoginPage } from "@/components/LoginPage";
import { Dashboard } from "@/dashboard/Dashboard";

const queryClient = new QueryClient();

type AppState = "loading" | "setup" | "login" | "dashboard";

function AppRoutes() {
  const [state, setState] = useState<AppState>("loading");
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  useEffect(() => {
    setupApi
      .status()
      .then((status: SetupStatus) => {
        if (!status.complete) {
          setState("setup");
        } else if (localStorage.getItem("token")) {
          setState("dashboard");
        } else {
          setState("login");
        }
      })
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
    return <SetupWizard onComplete={() => setState("dashboard")} />;
  }

  if (state === "login") {
    return <LoginPage onLogin={() => setState("dashboard")} />;
  }

  // dashboard
  void activeProject; // will be used by flow builder in next step
  return (
    <Dashboard
      onLogout={() => {
        setActiveProject(null);
        setState("login");
      }}
      onOpenProject={(project) => setActiveProject(project)}
    />
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  );
}
