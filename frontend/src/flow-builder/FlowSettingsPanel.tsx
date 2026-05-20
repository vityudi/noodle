import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { flowsApi, type Flow, type Project } from "@/lib/api";
import { X, Check, Bot, Copy, ChevronDown } from "lucide-react";

interface Props {
  project: Project;
  flow: Flow;
  onClose: () => void;
}

// ── Tool schema preview ───────────────────────────────────────────────────────

interface InputParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

function buildToolSchema(flow: Flow) {
  const trigger = extractTrigger(flow.flow_json);
  const inputs: InputParam[] = (trigger?.config?.inputs as InputParam[] | undefined) ?? [];

  const properties: Record<string, { type: string; description?: string }> = {};
  const required: string[] = [];

  for (const p of inputs) {
    properties[p.name] = { type: p.type };
    if (p.description) properties[p.name].description = p.description;
    if (p.required) required.push(p.name);
  }

  return {
    name: flow.name.toLowerCase().replace(/\s+/g, "_"),
    description: (trigger?.config?.description as string | undefined) ?? "(no description set)",
    inputSchema: {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
    },
  };
}

function extractTrigger(flowJson: object): { config: Record<string, unknown> } | null {
  const schema = flowJson as Record<string, unknown>;
  if (!schema) return null;

  // Noodle schema format
  if (Array.isArray(schema.nodes)) {
    const t = (schema.nodes as Array<{ type: string; config: Record<string, unknown> }>)
      .find((n) => n.type === "trigger");
    return t ?? null;
  }

  return null;
}

function ToolSchemaPreview({ flow }: { flow: Flow }) {
  const [copied, setCopied] = useState(false);
  const schema = buildToolSchema(flow);
  const json = JSON.stringify(schema, null, 2);

  function copy() {
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Tool schema (MCP)</p>
        <button
          onClick={copy}
          className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-400 transition"
        >
          {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-[11px] text-zinc-400 font-mono overflow-x-auto leading-relaxed">
        {json}
      </pre>
    </div>
  );
}

// ── How an AI uses this ───────────────────────────────────────────────────────

function AgentInteractionPreview({ flow, project }: { flow: Flow; project: Project }) {
  const [open, setOpen] = useState(true);
  const schema = buildToolSchema(flow);
  const trigger = extractTrigger(flow.flow_json);
  const inputs: InputParam[] = (trigger?.config?.inputs as InputParam[]) ?? [];

  const sampleArgs = inputs.reduce<Record<string, string>>((acc, p) => {
    const examples: Record<string, string> = {
      string: `"example_value"`,
      number: "42",
      boolean: "true",
      object: "{}",
      array: "[]",
    };
    acc[p.name] = examples[p.type] ?? `"…"`;
    return acc;
  }, {});

  const sampleArgsStr = Object.entries(sampleArgs)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const endpointUrl = `http://localhost:8080/mcp/${project.slug}`;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-zinc-800/50 transition"
      >
        <Bot size={13} className="text-violet-400 shrink-0" />
        <span className="text-xs font-medium text-zinc-300 flex-1 text-left">How an AI agent uses this</span>
        <ChevronDown size={12} className={`text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-zinc-800 space-y-3">
          {/* Step 1 - Connect */}
          <div>
            <p className="text-[11px] text-zinc-600 font-medium mb-1.5">① Connect the agent to Noodle</p>
            <div className="bg-zinc-950 rounded p-2 font-mono text-[11px] text-zinc-400 flex items-start justify-between gap-2">
              <span className="break-all">{endpointUrl}</span>
            </div>
            <p className="text-[11px] text-zinc-700 mt-1">Point any MCP-compatible agent (Claude, GPT-4o, etc.) at this URL.</p>
          </div>

          {/* Step 2 - Tool discovery */}
          <div>
            <p className="text-[11px] text-zinc-600 font-medium mb-1.5">② Agent discovers the tool</p>
            <div className="bg-zinc-950 rounded p-2 font-mono text-[11px] text-zinc-400">
              <span className="text-zinc-600">tool name: </span>
              <span className="text-violet-300">{schema.name}</span>
              <br />
              <span className="text-zinc-600">description: </span>
              <span className="text-zinc-400 italic">"{schema.description}"</span>
            </div>
          </div>

          {/* Step 3 - Invocation */}
          <div>
            <p className="text-[11px] text-zinc-600 font-medium mb-1.5">③ Agent calls the tool</p>
            <div className="bg-zinc-950 rounded p-2 font-mono text-[11px] text-violet-300">
              {schema.name}({sampleArgsStr || ""}){" "}
              <span className="text-zinc-600">→ runs your flow</span>
            </div>
          </div>

          {inputs.length === 0 && (
            <p className="text-[11px] text-amber-500/70 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5">
              Add input parameters to the Trigger node so the AI can pass data into this flow.
            </p>
          )}

          {!trigger?.config?.description && (
            <p className="text-[11px] text-amber-500/70 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5">
              Add a description to the Trigger node so the AI knows when to use this tool.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
    <div className="w-80 border-l border-zinc-800 bg-zinc-950 flex flex-col shrink-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <div>
          <p className="text-sm font-semibold text-zinc-100">Flow settings</p>
          <p className="text-xs text-zinc-500 truncate max-w-[200px]">{flow.name}</p>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Agent interaction preview */}
        <AgentInteractionPreview flow={flow} project={project} />

        {/* Flow type */}
        <div>
          <label className="block text-xs text-zinc-400 mb-2 font-medium">Exposed as</label>
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
          <p className="text-[11px] text-zinc-600 mt-2 leading-relaxed">
            {flowType === "tool"
              ? "The AI actively calls this with typed inputs — use for actions like fetching data or running a query."
              : "The AI reads this by URI without input — use for static or context data the agent polls."}
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
              The URI agents use to read this resource.
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

        {/* Tool schema */}
        {flowType === "tool" && <ToolSchemaPreview flow={flow} />}
      </div>
    </div>
  );
}
