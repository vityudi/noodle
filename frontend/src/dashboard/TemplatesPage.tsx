import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { templatesApi, projectsApi, type FlowTemplate } from "@/lib/api";
import { Layers, ArrowRight } from "lucide-react";
import { TemplateWizard } from "./TemplateWizard";

const CATEGORY_COLORS: Record<string, string> = {
  HTTP:       "bg-blue-500/10 text-blue-400 border-blue-500/20",
  Database:   "bg-violet-500/10 text-violet-400 border-violet-500/20",
  Monitoring: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  transform:  "bg-purple-500/10 text-purple-400 border-purple-500/20",
  auth:       "bg-amber-500/10 text-amber-400 border-amber-500/20",
  utility:    "bg-zinc-500/10 text-zinc-400 border-zinc-600",
};

function categoryStyle(cat: string) {
  return CATEGORY_COLORS[cat] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-600";
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

  const hasProjects = projects.length > 0;

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
                onClick={() => hasProjects && setSelectedTemplate(t)}
                disabled={!hasProjects}
                title={!hasProjects ? "Create a project first" : undefined}
                className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition group-hover:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Use template
                <ArrowRight size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedTemplate && (
        <TemplateWizard
          template={selectedTemplate}
          projects={projects}
          onClose={() => setSelectedTemplate(null)}
        />
      )}
    </div>
  );
}
