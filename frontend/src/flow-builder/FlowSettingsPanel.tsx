import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { flowsApi, type Flow, type Project } from "@/lib/api";
import { X, Check } from "lucide-react";

interface Props {
  project: Project;
  flow: Flow;
  onClose: () => void;
}

export function FlowSettingsPanel({ project, flow, onClose }: Props) {
  const queryClient = useQueryClient();
  const [flowType, setFlowType] = useState<"tool" | "resource">(flow.flow_type ?? "tool");
  const [resourceUri, setResourceUri] = useState(flow.resource_uri ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFlowType(flow.flow_type ?? "tool");
    setResourceUri(flow.resource_uri ?? "");
    setSaved(false);
  }, [flow.id]);

  const mutation = useMutation({
    mutationFn: () =>
      flowsApi.update(project.id, flow.id, {
        flow_type: flowType,
        resource_uri: flowType === "resource" ? resourceUri : "",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flows", project.id] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const defaultUri = `noodle://${project.slug}/${flow.name.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="w-72 border-l border-zinc-800 bg-zinc-950 flex flex-col shrink-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <div>
          <p className="text-sm font-medium text-zinc-100">Flow settings</p>
          <p className="text-xs text-zinc-500 truncate max-w-[180px]">{flow.name}</p>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Flow type */}
        <div>
          <label className="block text-xs text-zinc-400 mb-2 font-medium">Flow type</label>
          <div className="flex gap-2">
            {(["tool", "resource"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFlowType(t)}
                className={`flex-1 py-2 rounded-lg border text-xs font-medium transition capitalize ${
                  flowType === t
                    ? "bg-zinc-800 border-zinc-600 text-zinc-100"
                    : "border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-zinc-600 mt-2">
            {flowType === "tool"
              ? "Exposed as an MCP tool — agents can call it with typed inputs."
              : "Exposed as an MCP resource — agents can read it by URI without explicit input."}
          </p>
        </div>

        {/* Resource URI */}
        {flowType === "resource" && (
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Resource URI</label>
            <input
              value={resourceUri}
              onChange={(e) => setResourceUri(e.target.value)}
              placeholder={defaultUri}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-zinc-500"
            />
            <p className="text-[11px] text-zinc-600 mt-1.5">
              The URI agents use to read this resource. Leave blank to use the default.
            </p>
            {!resourceUri && (
              <button
                onClick={() => setResourceUri(defaultUri)}
                className="mt-1 text-[11px] text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition"
              >
                Use default: {defaultUri}
              </button>
            )}
          </div>
        )}

        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="w-full flex items-center justify-center gap-2 bg-white text-zinc-900 font-medium rounded-lg py-2 text-sm hover:bg-zinc-200 transition disabled:opacity-50"
        >
          {saved ? <Check size={14} className="text-green-600" /> : null}
          {mutation.isPending ? "Saving…" : saved ? "Saved" : "Save settings"}
        </button>
      </div>
    </div>
  );
}
