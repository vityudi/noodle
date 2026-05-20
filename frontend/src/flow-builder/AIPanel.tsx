import { useState } from "react";
import { aiApi, type Flow, type Project } from "@/lib/api";
import { X, Sparkles, RefreshCw, Check } from "lucide-react";

interface Props {
  project: Project;
  currentFlow: Flow | null;
  onGenerated: (schema: object) => void;
  onClose: () => void;
}

const EXAMPLES = [
  "Fetch a user by ID from my REST API and return name and email",
  "Check if a service URL is healthy and return status",
  "Get orders from my API and transform to a simplified format",
];

export function AIPanel({ project, currentFlow, onGenerated, onClose }: Props) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const hasCurrentFlow =
    currentFlow &&
    typeof currentFlow.flow_json === "object" &&
    (currentFlow.flow_json as Record<string, unknown>).schema_version === "1.0";

  async function generate() {
    if (!message.trim()) return;
    setError(null);
    setApplied(false);
    setLoading(true);

    try {
      const currentFlowJSON = hasCurrentFlow
        ? (currentFlow!.flow_json as object)
        : undefined;

      const schema = await aiApi.generate(project.id, message, currentFlowJSON);
      onGenerated(schema);
      setApplied(true);
      setTimeout(() => setApplied(false), 3000);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Generation failed. Check your AI settings.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      generate();
    }
  }

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-950 flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-violet-400" />
          <p className="text-sm font-medium text-zinc-100">AI Assistant</p>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Context hint */}
        {hasCurrentFlow && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-500">
            <RefreshCw size={11} className="inline mr-1.5 text-zinc-600" />
            Current flow included as context — AI will modify it.
          </div>
        )}

        {/* Input */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
            Describe the tool you want to build
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKey}
            rows={5}
            placeholder="e.g. Fetch a customer by email from my REST API and return their name and subscription plan"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
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

        {applied && (
          <div className="bg-green-950/40 border border-green-900 rounded-lg p-3 text-xs text-green-300 flex items-center gap-2">
            <Check size={13} />
            Flow applied to canvas — review and save.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800 shrink-0">
        <button
          onClick={generate}
          disabled={!message.trim() || loading}
          className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg py-2 text-sm transition disabled:opacity-50"
        >
          <Sparkles size={14} />
          {loading ? "Generating…" : "Generate flow"}
        </button>
      </div>
    </div>
  );
}
