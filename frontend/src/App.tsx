import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { api, setupApi, type Project, type SetupStatus } from "@/lib/api";
import { SetupWizard } from "@/components/setup/SetupWizard";
import { LoginPage } from "@/components/LoginPage";
import { Dashboard } from "@/dashboard/Dashboard";
import { ProjectPage, type ProjectTab } from "@/dashboard/ProjectPage";
import { FlowBuilder } from "@/flow-builder/FlowBuilder";
import { Sidebar, type SidebarPage } from "@/dashboard/Sidebar";
import { GlobalAIChat } from "@/components/GlobalAIChat";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,   // dados são "fresh" por 30s — navegação entre abas não refaz fetch
      gcTime:    5 * 60 * 1000, // cache mantido por 5 min após última use
      retry: 1,
    },
  },
});

type AuthState = "loading" | "setup" | "login" | "authenticated";

function AppRoutes() {
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [page, setPage] = useState<SidebarPage>("projects");
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [inBuilder, setInBuilder] = useState(false);
  const [projectTab, setProjectTab] = useState<ProjectTab>("flows");

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
    setInBuilder(false);
  }

  function handleOpenProject(project: Project) {
    setActiveProject(project);
    setInBuilder(false);
    setProjectTab("flows");
  }

  function handleCloseProject() {
    setActiveProject(null);
    setInBuilder(false);
    setProjectTab("flows");
    setPage("projects");
  }

  function handleOpenBuilder() {
    setInBuilder(true);
  }

  function handleCloseBuilder() {
    setInBuilder(false);
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
        inBuilder={inBuilder}
        projectTab={projectTab}
        onNavigate={handleNavigate}
        onProjectTabChange={setProjectTab}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeProject && inBuilder ? (
          <FlowBuilder project={activeProject} onBack={handleCloseBuilder} />
        ) : activeProject ? (
          <ProjectPage
            project={activeProject}
            tab={projectTab}
            onTabChange={setProjectTab}
            onBack={handleCloseProject}
            onOpenBuilder={handleOpenBuilder}
          />
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
