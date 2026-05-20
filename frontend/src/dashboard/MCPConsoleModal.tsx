import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { mcpApi, type MCPTool, type MCPResource, type Project } from "@/lib/api";
import { X, Play, ChevronRight, Wrench, Database } from "lucide-react";

interface Props {
  project: Project;
  onClose: () => void;
}

type Mode = "tools" | "resources";

export function MCPConsoleModal({ project, onClose }: Props) {
  const [mode, setMode] = useState<Mode>("tools");
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [selectedResource, setSelectedResource] = useState<MCPResource | null>(null);
  const [input, setInput] = useState("{}");
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const { data: toolsData, isLoading: loadingTools } = useQuery({
    queryKey: ["mcp-tools", project.slug],
    queryFn: () => mcpApi.listTools(project.slug),
  });

  const { data: resourcesData, isLoading: loadingResources } = useQuery({
    queryKey: ["mcp-resources", project.slug],
    queryFn: () => mcpApi.listResources(project.slug),
  });

  const tools = toolsData?.tools ?? [];
  const resources = resourcesData?.resources ?? [];

  function selectTool(tool: MCPTool) {
    setSelectedTool(tool);
    setSelectedResource(null);
    setResult(null);
    setError(null);

    const props = tool.inputSchema?.properties ?? {};
    const skeleton = Object.fromEntries(Object.keys(props).map((k) => [k, ""]));
    setInput(JSON.stringify(skeleton, null, 2));
  }

  function selectResource(resource: MCPResource) {
    setSelectedResource(resource);
    setSelectedTool(null);
    setResult(null);
    setError(null);
  }

  async function run() {
    setError(null);
    setResult(null);
    setRunning(true);

    try {
      if (selectedTool) {
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(input);
        } catch {
          setError("Invalid JSON input");
          return;
        }
        const data = await mcpApi.callTool(project.slug, selectedTool.name, parsed);
        setResult(data.output ?? data);
      } else if (selectedResource) {
        const data = await mcpApi.readResource(project.slug, selectedResource.uri);
        setResult(data);
      }
    } catch (e: unknown) {
      setError(
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          "Execution failed"
      );
    } finally {
      setRunning(false);
    }
  }

  const isLoading = mode === "tools" ? loadingTools : loadingResources;
  const isEmpty = mode === "tools" ? tools.length === 0 : resources.length === 0;
  const selected = selectedTool ?? selectedResource;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl h-[560px] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">MCP Console</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{project.name}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition">
            <X size={16} />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 px-5 pt-3 shrink-0">
          <button
            onClick={() => setMode("tools")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              mode === "tools" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Wrench size={12} />
            Tools{tools.length > 0 && <span className="text-zinc-500">({tools.length})</span>}
          </button>
          <button
            onClick={() => setMode("resources")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
              mode === "resources" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <Database size={12} />
            Resources{resources.length > 0 && <span className="text-zinc-500">({resources.length})</span>}
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden mt-3">
          {/* Left — list */}
          <div className="w-48 border-r border-zinc-800 overflow-y-auto shrink-0">
            {isLoading ? (
              <p className="px-4 py-3 text-xs text-zinc-500">Loading…</p>
            ) : isEmpty ? (
              <p className="px-4 py-3 text-xs text-zinc-500">
                No {mode} registered yet.
              </p>
            ) : mode === "tools" ? (
              tools.map((tool) => (
                <button
                  key={tool.name}
                  onClick={() => selectTool(tool)}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 transition ${
                    selectedTool?.name === tool.name
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                  }`}
                >
                  <span className="text-xs truncate">{tool.name}</span>
                  <ChevronRight size={12} className="shrink-0 opacity-50" />
                </button>
              ))
            ) : (
              resources.map((res) => (
                <button
                  key={res.uri}
                  onClick={() => selectResource(res)}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 transition ${
                    selectedResource?.uri === res.uri
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                  }`}
                >
                  <span className="text-xs truncate">{res.name}</span>
                  <ChevronRight size={12} className="shrink-0 opacity-50" />
                </button>
              ))
            )}
          </div>

          {/* Right — detail + run */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selected ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-zinc-600">
                  Select a {mode === "tools" ? "tool" : "resource"} to test
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-y-auto p-4 gap-3">
                {/* Info */}
                <div>
                  <p className="text-xs font-medium text-zinc-100">
                    {selectedTool?.name ?? selectedResource?.name}
                  </p>
                  {(selectedTool?.description || selectedResource?.description) && (
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {selectedTool?.description ?? selectedResource?.description}
                    </p>
                  )}
                  {selectedResource && (
                    <p className="text-xs text-zinc-600 font-mono mt-1">{selectedResource.uri}</p>
                  )}
                </div>

                {/* Input — only for tools */}
                {selectedTool && (
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1 font-medium">
                      Input <span className="text-zinc-600 font-normal">(JSON)</span>
                    </label>
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      rows={5}
                      spellCheck={false}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-zinc-500 resize-none"
                    />
                  </div>
                )}

                <button
                  onClick={run}
                  disabled={running}
                  className="flex items-center justify-center gap-2 bg-white text-zinc-900 font-medium rounded-lg py-2 text-sm hover:bg-zinc-200 transition disabled:opacity-50"
                >
                  <Play size={13} />
                  {running ? "Running…" : selectedTool ? "Call tool" : "Read resource"}
                </button>

                {/* Result */}
                {(result !== null || error) && (
                  <div>
                    <p className={`text-xs font-medium mb-1 ${error ? "text-red-400" : "text-green-400"}`}>
                      {error ? "Error" : "Output"}
                    </p>
                    {error ? (
                      <div className="bg-red-950/40 border border-red-900 rounded-lg p-3 text-xs text-red-300 font-mono break-all">
                        {error}
                      </div>
                    ) : (
                      <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(result, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
