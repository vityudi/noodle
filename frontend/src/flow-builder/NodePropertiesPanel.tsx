import { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import { type Node } from "@xyflow/react";

interface Props {
  node: Node;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  trigger:       "Trigger",
  httpRequest:   "HTTP Request",
  jsonTransform: "JSON Transform",
  condition:     "Condition",
  variable:      "Variable",
  loop:          "Loop",
  merge:         "Merge",
};

export function NodePropertiesPanel({ node, onUpdate, onClose }: Props) {
  const data = node.data as { label?: string; config?: Record<string, unknown> };
  const [label, setLabel] = useState(data.label ?? "");
  const [configText, setConfigText] = useState(
    JSON.stringify(data.config ?? {}, null, 2)
  );
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLabel(data.label ?? "");
    setConfigText(JSON.stringify(data.config ?? {}, null, 2));
    setError("");
    setSaved(false);
  }, [node.id]);

  function apply() {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(configText);
    } catch {
      setError("Invalid JSON");
      return;
    }
    setError("");
    onUpdate(node.id, { ...data, label, config: parsed });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="w-72 border-l border-zinc-800 bg-zinc-950 flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <div>
          <p className="text-sm font-medium text-zinc-100">
            {TYPE_LABELS[node.type ?? ""] ?? node.type}
          </p>
          <p className="text-xs text-zinc-500 font-mono">{node.id.slice(0, 8)}…</p>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Label */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
          />
        </div>

        {/* Config */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
            Config{" "}
            <span className="text-zinc-600 font-normal">(JSON)</span>
          </label>
          <textarea
            value={configText}
            onChange={(e) => { setConfigText(e.target.value); setError(""); setSaved(false); }}
            rows={12}
            spellCheck={false}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-zinc-500 resize-none"
          />
          {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
        </div>

        {/* Template ref hint */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-1">
          <p className="text-xs text-zinc-500 font-medium mb-2">Template refs</p>
          {[
            "{{input.field}}",
            "{{nodes.id.outputs.field}}",
            "{{env.VAR_NAME}}",
            "{{credentials.name.field}}",
          ].map((ref) => (
            <code key={ref} className="block text-xs text-zinc-400 font-mono">{ref}</code>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-zinc-800 shrink-0">
        <button
          onClick={apply}
          className="w-full flex items-center justify-center gap-2 bg-white text-zinc-900 font-medium rounded-lg py-2 text-sm hover:bg-zinc-200 transition"
        >
          {saved ? <Check size={14} className="text-green-600" /> : null}
          {saved ? "Applied" : "Apply changes"}
        </button>
      </div>
    </div>
  );
}
