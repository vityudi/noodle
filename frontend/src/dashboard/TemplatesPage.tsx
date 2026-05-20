import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { templatesApi, projectsApi, flowsApi, type FlowTemplate, type Project } from "@/lib/api";
import { Layers, ArrowRight, X, Check } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  rest:         "bg-blue-500/10 text-blue-400 border-blue-500/20",
  transform:    "bg-purple-500/10 text-purple-400 border-purple-500/20",
  auth:         "bg-amber-500/10 text-amber-400 border-amber-500/20",
  utility:      "bg-zinc-500/10 text-zinc-400 border-zinc-600",
};

function categoryStyle(cat: string) {
  return CATEGORY_COLORS[cat] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-600";
}

interface UseDialogProps {
  template: FlowTemplate;
  projects: Project[];
  onClose: () => void;
}

function UseTemplateDialog({ template, projects, onClose }: UseDialogProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? "");
  const [flowName, setFlowName] = useState(template.name.toLowerCase().replace(/\s+/g, "_"));
  const [done, setDone] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      flowsApi.create(selectedProjectId, {
        name: flowName,
        description: template.description,
        flow_json: template.flow,
      }),
    onSuccess: () => setDone(true),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Use template</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{template.name}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition">
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Check size={18} className="text-emerald-400" />
            </div>
            <p className="text-sm text-zinc-300">Flow created successfully.</p>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-sm hover:bg-zinc-700 transition"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-1.5">Project</label>
              {projects.length === 0 ? (
                <p className="text-xs text-zinc-500">No projects yet. Create a project first.</p>
              ) : (
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-400 block mb-1.5">Flow name</label>
              <input
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
                placeholder="flow_name"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-zinc-200 hover:border-zinc-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => create.mutate()}
                disabled={create.isPending || !selectedProjectId || !flowName}
                className="flex-1 px-4 py-2 rounded-lg bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {create.isPending ? "Creating…" : "Create flow"}
              </button>
            </div>

            {create.isError && (
              <p className="text-xs text-red-400">Failed to create flow. Try a different name.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function TemplatesPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<FlowTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: templatesApi.list,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const categories = [...new Set(templates.map((t) => t.category))];

  const filtered = activeCategory
    ? templates.filter((t) => t.category === activeCategory)
    : templates;

  if (isLoading) {
    return <div className="text-zinc-500 text-sm">Loading templates…</div>;
  }

  return (
    <div>
      {/* Category filters */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-3 py-1 rounded-full text-xs border transition ${
              activeCategory === null
                ? "bg-zinc-700 text-zinc-100 border-zinc-600"
                : "bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-300"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              className={`px-3 py-1 rounded-full text-xs border transition ${
                activeCategory === cat
                  ? "bg-zinc-700 text-zinc-100 border-zinc-600"
                  : "bg-transparent text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded-xl p-16 text-center">
          <Layers size={32} className="mx-auto text-zinc-700 mb-3" />
          <p className="text-zinc-500 text-sm">No templates available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="group bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3 hover:border-zinc-700 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium text-zinc-100 leading-snug">{t.name}</h3>
                <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border ${categoryStyle(t.category)}`}>
                  {t.category}
                </span>
              </div>

              <p className="text-xs text-zinc-500 flex-1 leading-relaxed">{t.description}</p>

              <button
                onClick={() => setSelectedTemplate(t)}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition group-hover:text-zinc-300"
              >
                Use template
                <ArrowRight size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedTemplate && (
        <UseTemplateDialog
          template={selectedTemplate}
          projects={projects}
          onClose={() => setSelectedTemplate(null)}
        />
      )}
    </div>
  );
}
