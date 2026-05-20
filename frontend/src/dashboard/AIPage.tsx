import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { aiApi, flowsApi, projectsApi, type Project } from "@/lib/api";
import { Sparkles, ChevronRight } from "lucide-react";

const EXAMPLES = [
  "Fetch a customer by email from my REST API and return their name and plan",
  "Check if a service URL is healthy and return the status code",
  "Get orders from my API, filter completed ones, and return a summary",
  "Call my GraphQL API with a bearer token and transform the response",
];

interface Props {
  onOpenProject: (project: Project) => void;
}

export function AIPage({ onOpenProject }: Props) {
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatedFlow, setGeneratedFlow] = useState<Record<string, unknown> | null>(null);
  const [savedFlow, setSavedFlow] = useState<{ project: Project; flowId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const selectedProject = projects.find((p) => p.id === projectId) ?? projects[0];

  async function generate() {
    if (!message.trim() || !selectedProject) return;
    setError(null);
    setGeneratedFlow(null);
    setSavedFlow(null);
    setGenerating(true);
    try {
      const flow = await aiApi.generate(selectedProject.id, message);
      setGeneratedFlow(flow as Record<string, unknown>);
    } catch (e: unknown) {
      setError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          "Generation failed. Check your AI settings."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    if (!generatedFlow || !selectedProject) return;
    setSaving(true);
    try {
      const name = (generatedFlow.name as string) || "ai_generated_flow";
      const description = (generatedFlow.description as string) || "";
      const flow = await flowsApi.create(selectedProject.id, {
        name,
        description,
        flow_json: generatedFlow,
      });
      qc.invalidateQueries({ queryKey: ["flows", selectedProject.id] });
      setSavedFlow({ project: selectedProject, flowId: flow.id });
    } finally {
      setSaving(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate();
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Left — input */}
        <div className="w-96 shrink-0 border-r border-zinc-800 flex flex-col overflow-y-auto p-6 space-y-5">
          {/* Project selector */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Project</label>
            <select
              value={selectedProject?.id ?? ""}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600"
            >
              {projects.length === 0 ? (
                <option value="">No projects yet</option>
              ) : (
                projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))
              )}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
              Describe the tool you want to build
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKey}
              rows={6}
              placeholder="e.g. Fetch a customer by email from my REST API and return their name and subscription plan"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 resize-none"
            />
            <p className="text-xs text-zinc-600 mt-1">⌘ + Enter to generate</p>
          </div>

          {/* Examples */}
          {!message && (
            <div>
              <p className="text-xs text-zinc-500 font-medium mb-2">Examples</p>
              <div className="space-y-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setMessage(ex)}
                    className="w-full text-left text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 hover:border-zinc-700 hover:text-zinc-300 transition"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-950/40 border border-red-900 rounded-lg p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={generate}
            disabled={!message.trim() || !selectedProject || generating}
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg py-2.5 text-sm transition disabled:opacity-50"
          >
            <Sparkles size={15} />
            {generating ? "Generating…" : "Generate flow"}
          </button>
        </div>

        {/* Right — output */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!generatedFlow && !generating ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <Sparkles size={32} className="text-zinc-700 mb-4" />
              <p className="text-zinc-400 text-sm font-medium mb-1">
                Describe a tool and let AI build the flow
              </p>
              <p className="text-zinc-600 text-xs max-w-sm">
                The AI will generate a complete Noodle flow with nodes, edges, and template references ready to use.
              </p>
            </div>
          ) : generating ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-zinc-500 text-sm flex items-center gap-2">
                <Sparkles size={16} className="animate-pulse text-violet-400" />
                Generating flow…
              </div>
            </div>
          ) : generatedFlow ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Flow summary */}
              <div className="shrink-0 border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">
                    {(generatedFlow.name as string) || "Generated flow"}
                  </p>
                  {generatedFlow.description && (
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {generatedFlow.description as string}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-600">
                    <span>{(generatedFlow.nodes as unknown[])?.length ?? 0} nodes</span>
                    <span>{(generatedFlow.edges as unknown[])?.length ?? 0} edges</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {savedFlow ? (
                    <button
                      onClick={() => onOpenProject(savedFlow.project)}
                      className="flex items-center gap-1.5 text-sm text-green-400 border border-green-800 rounded-lg px-3 py-1.5 hover:bg-green-950/40 transition"
                    >
                      Open in builder
                      <ChevronRight size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={save}
                      disabled={saving}
                      className="flex items-center gap-2 bg-white text-zinc-900 font-medium rounded-lg px-4 py-1.5 text-sm hover:bg-zinc-200 transition disabled:opacity-50"
                    >
                      {saving ? "Saving…" : `Save to ${selectedProject?.name ?? "project"}`}
                    </button>
                  )}
                </div>
              </div>

              {/* JSON preview */}
              <div className="flex-1 overflow-y-auto p-6">
                <pre className="text-xs font-mono text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-xl p-5 overflow-x-auto whitespace-pre leading-relaxed">
                  {JSON.stringify(generatedFlow, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
