import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, type Project } from "@/lib/api";
import { ProjectCard } from "./ProjectCard";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { SchemaPage } from "./SchemaPage";
import { LogsPage } from "./LogsPage";
import { SettingsPage } from "./SettingsPage";
import { TemplatesPage } from "./TemplatesPage";
import { type SidebarPage } from "./Sidebar";
import { Plus } from "lucide-react";

interface Props {
  page: SidebarPage;
  onOpenProject: (project: Project) => void;
}

const PAGE_META: Record<SidebarPage, { title: string; subtitle: string }> = {
  projects:  { title: "Projects",       subtitle: "Each project exposes a set of tools via an MCP endpoint." },
  templates: { title: "Templates",      subtitle: "Ready-made flows you can use as a starting point." },
  logs:      { title: "Execution Logs", subtitle: "Last 100 tool executions per project." },
  schema:    { title: "Flow Schema",    subtitle: "Public JSON Schema spec for the Noodle flow format." },
  settings:  { title: "Settings",       subtitle: "Configure the AI assistant and other instance settings." },
};

export function Dashboard({ page, onOpenProject }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });

  const meta = PAGE_META[page];

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Sticky page header */}
      <header className="shrink-0 border-b border-zinc-800 bg-zinc-950 px-8 h-12 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-zinc-100">{meta.title}</h1>

        {page === "projects" && (
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 bg-white text-zinc-900 font-medium rounded-lg px-4 py-2 text-sm hover:bg-zinc-200 transition"
          >
            <Plus size={15} />
            New project
          </button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="px-8 py-8 max-w-5xl">

          {page === "projects" && (
            <>
              {isLoading ? (
                <div className="text-zinc-500 text-sm">Loading…</div>
              ) : projects.length === 0 ? (
                <div className="border border-dashed border-zinc-800 rounded-xl p-16 text-center">
                  <div className="text-4xl mb-3">🍜</div>
                  <p className="text-zinc-400 text-sm">No projects yet. Create your first MCP project.</p>
                  <button
                    onClick={() => setCreateOpen(true)}
                    className="mt-4 bg-white text-zinc-900 font-medium rounded-lg px-4 py-2 text-sm hover:bg-zinc-200 transition"
                  >
                    Create project
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {projects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onDelete={(id) => deleteMutation.mutate(id)}
                      onOpen={onOpenProject}
                    />
                  ))}
                </div>
              )}

              <CreateProjectDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={(project) => {
                  queryClient.invalidateQueries({ queryKey: ["projects"] });
                  onOpenProject(project);
                }}
              />
            </>
          )}

          {page === "templates" && <TemplatesPage />}
          {page === "logs"      && <LogsPage />}
          {page === "schema"    && <SchemaPage />}
          {page === "settings"  && <SettingsPage />}
        </div>
      </main>
    </div>
  );
}
