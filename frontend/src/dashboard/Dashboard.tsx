import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi, type Project } from "@/lib/api";
import { ProjectCard } from "./ProjectCard";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { Plus, LogOut } from "lucide-react";

interface Props {
  onLogout: () => void;
  onOpenProject: (project: Project) => void;
}

export function Dashboard({ onLogout, onOpenProject }: Props) {
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

  function handleLogout() {
    localStorage.removeItem("token");
    onLogout();
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🍜</span>
            <span className="font-semibold">Noodle</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">MCP Projects</h1>
            <p className="text-zinc-400 text-sm mt-1">
              Each project exposes a set of tools via an MCP endpoint.
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 bg-white text-zinc-900 font-medium rounded-lg px-4 py-2 text-sm hover:bg-zinc-200 transition"
          >
            <Plus size={16} />
            New project
          </button>
        </div>

        {isLoading ? (
          <div className="text-zinc-500 text-sm">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="border border-dashed border-zinc-800 rounded-xl p-16 text-center">
            <div className="text-4xl mb-3">🍜</div>
            <p className="text-zinc-400 text-sm">
              No projects yet. Create your first MCP project.
            </p>
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
      </main>

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["projects"] })}
      />
    </div>
  );
}
