import { useState } from "react";
import { mcpApi, type Flow, type Project } from "@/lib/api";
import { Play, X, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  project: Project;
  flow: Flow;
  onClose: () => void;
}

export function TestPanel({ project, flow, onClose }: Props) {
  const [input, setInput] = useState("{}");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [showOutput, setShowOutput] = useState(false);

  async function run() {
    setError(null);
    setResult(null);
    setRunning(true);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(input);
    } catch {
      setError("Invalid JSON input");
      setRunning(false);
      return;
    }

    try {
      const data = await mcpApi.callTool(project.slug, flow.name, parsed);
      setResult(data.output ?? data);
      setShowOutput(true);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Execution failed";
      setError(msg);
      setShowOutput(true);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-950 flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <div>
          <p className="text-sm font-medium text-zinc-100">Test flow</p>
          <p className="text-xs text-zinc-500 truncate max-w-[200px]">{flow.name}</p>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Input */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
            Input <span className="text-zinc-600 font-normal">(JSON)</span>
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={6}
            spellCheck={false}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-zinc-500 resize-none"
          />
        </div>

        <button
          onClick={run}
          disabled={running}
          className="w-full flex items-center justify-center gap-2 bg-white text-zinc-900 font-medium rounded-lg py-2 text-sm hover:bg-zinc-200 transition disabled:opacity-50"
        >
          <Play size={14} />
          {running ? "Running…" : "Run"}
        </button>

        {/* Output */}
        {showOutput && (
          <div>
            <button
              onClick={() => setShowOutput((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1.5 font-medium w-full"
            >
              {showOutput ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {error ? (
                <span className="text-red-400">Error</span>
              ) : (
                <span className="text-green-400">Output</span>
              )}
            </button>

            {error ? (
              <div className="bg-red-950/40 border border-red-900 rounded-lg p-3 text-xs text-red-300 font-mono break-all">
                {error}
              </div>
            ) : (
              <pre className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs text-zinc-200 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
