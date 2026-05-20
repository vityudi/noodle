import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { openAPIApi, flowsApi, type SuggestedFlow, type Project } from "@/lib/api";
import { X, Download, Check, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  project: Project;
  onClose: () => void;
  onImported: () => void;
}

type Step = "source" | "select" | "done";
type SourceTab = "url" | "paste";

const METHOD_COLORS: Record<string, string> = {
  GET:    "bg-blue-500/10 text-blue-400",
  POST:   "bg-green-500/10 text-green-400",
  PUT:    "bg-yellow-500/10 text-yellow-400",
  PATCH:  "bg-orange-500/10 text-orange-400",
  DELETE: "bg-red-500/10 text-red-400",
};

export function OpenAPIImportModal({ project, onClose, onImported }: Props) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("source");
  const [sourceTab, setSourceTab] = useState<SourceTab>("url");
  const [url, setUrl] = useState("");
  const [spec, setSpec] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; endpoints: SuggestedFlow[] } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importedCount, setImportedCount] = useState(0);
  const [showSpec, setShowSpec] = useState(false);

  const parseMutation = useMutation({
    mutationFn: () =>
      openAPIApi.preview(project.id, sourceTab === "url" ? { url } : { spec }),
    onSuccess: (data) => {
      setParseError(null);
      setPreview(data);
      setSelected(new Set(data.endpoints.map((e) => endpointKey(e))));
      setStep("select");
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Could not parse spec";
      setParseError(msg);
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const toImport = preview!.endpoints.filter((e) => selected.has(endpointKey(e)));
      for (const endpoint of toImport) {
        await flowsApi.create(project.id, {
          name: endpoint.name,
          description: endpoint.description,
          flow_json: endpoint.flow_json,
          flow_type: "tool",
        });
      }
      return toImport.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["flows", project.id] });
      setImportedCount(count);
      setStep("done");
      onImported();
    },
  });

  function endpointKey(e: SuggestedFlow) {
    return `${e.method}:${e.path}`;
  }

  function toggleAll() {
    if (selected.size === preview!.endpoints.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(preview!.endpoints.map((e) => endpointKey(e))));
    }
  }

  function toggleOne(e: SuggestedFlow) {
    const key = endpointKey(e);
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const canParse = sourceTab === "url" ? url.trim() !== "" : spec.trim() !== "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Import from OpenAPI</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Generate flows automatically from an API spec
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Step 1: Source ── */}
          {step === "source" && (
            <div className="p-6 space-y-4">
              {/* Source tabs */}
              <div className="flex gap-1 bg-zinc-800 p-1 rounded-lg">
                {(["url", "paste"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSourceTab(t)}
                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition ${
                      sourceTab === t ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {t === "url" ? "From URL" : "Paste spec"}
                  </button>
                ))}
              </div>

              {sourceTab === "url" ? (
                <div className="space-y-1.5">
                  <label className="block text-xs text-zinc-400 font-medium">Spec URL</label>
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://api.example.com/openapi.json"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                  />
                  <p className="text-[11px] text-zinc-600">
                    Supports OpenAPI 3.x and Swagger 2.x — JSON or YAML.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs text-zinc-400 font-medium">Spec content</label>
                    <button
                      onClick={() => setShowSpec((v) => !v)}
                      className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300"
                    >
                      {showSpec ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      {showSpec ? "Collapse" : "Expand"}
                    </button>
                  </div>
                  <textarea
                    value={spec}
                    onChange={(e) => setSpec(e.target.value)}
                    rows={showSpec ? 16 : 8}
                    spellCheck={false}
                    placeholder={'{\n  "openapi": "3.0.0",\n  ...\n}'}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
                  />
                  <p className="text-[11px] text-zinc-600">JSON or YAML accepted.</p>
                </div>
              )}

              {parseError && (
                <div className="flex items-start gap-2 bg-red-950/40 border border-red-900 rounded-lg p-3">
                  <AlertCircle size={13} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{parseError}</p>
                </div>
              )}

              <button
                onClick={() => parseMutation.mutate()}
                disabled={!canParse || parseMutation.isPending}
                className="w-full flex items-center justify-center gap-2 bg-white text-zinc-900 font-medium rounded-lg py-2.5 text-sm hover:bg-zinc-200 transition disabled:opacity-50"
              >
                <Download size={14} />
                {parseMutation.isPending ? "Parsing…" : "Parse spec"}
              </button>
            </div>
          )}

          {/* ── Step 2: Select endpoints ── */}
          {step === "select" && preview && (
            <div className="flex flex-col">
              {/* Summary bar */}
              <div className="px-6 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
                <div>
                  <p className="text-sm font-medium text-zinc-100">{preview.title || "API"}</p>
                  <p className="text-xs text-zinc-500">{preview.endpoints.length} endpoints found</p>
                </div>
                <button
                  onClick={toggleAll}
                  className="text-xs text-zinc-400 hover:text-zinc-200 transition underline underline-offset-2"
                >
                  {selected.size === preview.endpoints.length ? "Deselect all" : "Select all"}
                </button>
              </div>

              {/* Endpoint list */}
              <div className="overflow-y-auto max-h-72">
                {preview.endpoints.map((endpoint) => {
                  const key = endpointKey(endpoint);
                  const isSelected = selected.has(key);
                  const methodColor = METHOD_COLORS[endpoint.method] ?? "bg-zinc-500/10 text-zinc-400";

                  return (
                    <label
                      key={key}
                      className={`flex items-start gap-3 px-6 py-3 cursor-pointer transition border-b border-zinc-800/60 last:border-0 ${
                        isSelected ? "bg-zinc-800/40" : "hover:bg-zinc-800/20"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(endpoint)}
                        className="mt-0.5 accent-white shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${methodColor}`}>
                            {endpoint.method}
                          </span>
                          <span className="text-xs text-zinc-300 font-mono truncate">{endpoint.path}</span>
                        </div>
                        {(endpoint.description || endpoint.name) && (
                          <p className="text-[11px] text-zinc-500 mt-0.5 truncate">
                            {endpoint.description || endpoint.name}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-zinc-800 flex gap-2 shrink-0">
                <button
                  onClick={() => { setStep("source"); setParseError(null); }}
                  className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-zinc-200 hover:border-zinc-600 transition"
                >
                  Back
                </button>
                <button
                  onClick={() => importMutation.mutate()}
                  disabled={selected.size === 0 || importMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 bg-white text-zinc-900 font-medium rounded-lg py-2 text-sm hover:bg-zinc-200 transition disabled:opacity-50"
                >
                  <Download size={14} />
                  {importMutation.isPending
                    ? "Importing…"
                    : `Import ${selected.size} flow${selected.size !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === "done" && (
            <div className="p-6 flex flex-col items-center gap-4 py-10">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <Check size={22} className="text-green-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-zinc-100">
                  {importedCount} flow{importedCount !== 1 ? "s" : ""} imported
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Each flow is now available as an MCP tool. Add credentials and adjust configs if needed.
                </p>
              </div>
              <button
                onClick={onClose}
                className="mt-2 px-6 py-2 bg-white text-zinc-900 font-medium rounded-lg text-sm hover:bg-zinc-200 transition"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
