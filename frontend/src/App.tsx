import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api, setupApi, type Project, type SetupStatus } from "@/lib/api";
import { SetupWizard } from "@/components/setup/SetupWizard";
import { LoginPage } from "@/components/LoginPage";
import { Dashboard } from "@/dashboard/Dashboard";
import { FlowBuilder } from "@/flow-builder/FlowBuilder";
import { Sidebar, type SidebarPage } from "@/dashboard/Sidebar";
import { GlobalAIChat } from "@/components/GlobalAIChat";

const queryClient = new QueryClient();

type AuthState = "loading" | "setup" | "login" | "authenticated";

function AppRoutes() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [page, setPage] = useState<SidebarPage>("projects");
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  useEffect(() => {
    const devMode = import.meta.env.VITE_DEV_MODE === "true";

    if (devMode) {
      api
        .post<{ token: string }>("/api/dev/auto-login")
        .then((r) => {
          localStorage.setItem("token", r.data.token);
          setAuthState("authenticated");
        })
        .catch(() => setAuthState("loading"));
      return;
    }

    setupApi
      .status()
      .then((status: SetupStatus) => {
        if (!status.complete) setAuthState("setup");
        else if (localStorage.getItem("token")) setAuthState("authenticated");
        else setAuthState("login");
      })
      .catch(() => setAuthState("setup"));
  }, []);

  function handleLogout() {
    localStorage.removeItem("token");
    setActiveProject(null);
    setPage("projects");
    setAuthState("login");
  }

  function handleNavigate(p: SidebarPage) {
    setPage(p);
    setActiveProject(null);
  }

  function handleOpenProject(project: Project) {
    setActiveProject(project);
  }

  function handleCloseProject() {
    setActiveProject(null);
    setPage("projects");
  }

  if (authState === "loading") {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500 text-sm">Loading…</div>
      </div>
    );
  }

  if (authState === "setup") return <SetupWizard onComplete={() => setAuthState("authenticated")} />;
  if (authState === "login") return <LoginPage onLogin={() => setAuthState("authenticated")} />;

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
      <Sidebar
        active={page}
        activeProject={activeProject}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeProject ? (
          <FlowBuilder project={activeProject} onBack={handleCloseProject} />
        ) : (
          <Dashboard page={page} onOpenProject={handleOpenProject} />
        )}
      </div>

      <GlobalAIChat onOpenProject={handleOpenProject} />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  );
}
