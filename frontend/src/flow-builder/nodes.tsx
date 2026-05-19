import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Globe, Braces, GitBranch, Zap } from "lucide-react";

function nodeBase(
  icon: React.ReactNode,
  label: string,
  color: string,
  selected: boolean,
  children?: React.ReactNode,
  extraHandles?: React.ReactNode
) {
  return (
    <div
      className={`bg-zinc-900 border rounded-xl shadow-lg min-w-[180px] transition-shadow ${
        selected ? "border-white/40 shadow-white/10" : `border-zinc-700`
      }`}
    >
      <div className={`flex items-center gap-2 px-3 py-2 border-b border-zinc-800`}>
        <div className={`text-${color}`}>{icon}</div>
        <span className="text-sm font-medium text-zinc-100 truncate">{label}</span>
      </div>
      {children && (
        <div className="px-3 py-2 text-xs text-zinc-400 space-y-1">{children}</div>
      )}
      <Handle type="target" position={Position.Top} className="!bg-zinc-500 !border-zinc-400 !w-3 !h-3" />
      {extraHandles ?? (
        <Handle type="source" position={Position.Bottom} className="!bg-zinc-500 !border-zinc-400 !w-3 !h-3" />
      )}
    </div>
  );
}

export const TriggerNode = memo(({ data, selected }: NodeProps) => {
  const d = data as { label?: string; config?: { description?: string } };
  return (
    <div
      className={`bg-zinc-900 border rounded-xl shadow-lg min-w-[180px] ${
        selected ? "border-violet-400/60" : "border-violet-700"
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
        <Zap size={14} className="text-violet-400" />
        <span className="text-sm font-medium text-zinc-100">{d.label ?? "Trigger"}</span>
      </div>
      {d.config?.description && (
        <div className="px-3 py-2 text-xs text-zinc-400">{d.config.description}</div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-violet-500 !border-violet-400 !w-3 !h-3" />
    </div>
  );
});
TriggerNode.displayName = "TriggerNode";

export const HttpRequestNode = memo(({ data, selected }: NodeProps) => {
  const d = data as { label?: string; config?: { url?: string; method?: string } };
  const method = d.config?.method ?? "GET";
  const url = d.config?.url ?? "";
  return nodeBase(
    <Globe size={14} />,
    d.label ?? "HTTP Request",
    "blue-400",
    !!selected,
    <>
      <div className="flex items-center gap-1.5">
        <span className="text-blue-400 font-mono font-semibold">{method}</span>
        <span className="truncate text-zinc-500 max-w-[120px]">{url || "—"}</span>
      </div>
    </>
  );
});
HttpRequestNode.displayName = "HttpRequestNode";

export const JsonTransformNode = memo(({ data, selected }: NodeProps) => {
  const d = data as { label?: string; config?: { mapping?: object } };
  const keys = Object.keys(d.config?.mapping ?? {});
  return nodeBase(
    <Braces size={14} />,
    d.label ?? "JSON Transform",
    "amber-400",
    !!selected,
    keys.length > 0 ? (
      <div className="text-zinc-500">{keys.length} mapping{keys.length !== 1 ? "s" : ""}</div>
    ) : (
      <div className="text-zinc-600 italic">No mappings</div>
    )
  );
});
JsonTransformNode.displayName = "JsonTransformNode";

export const ConditionNode = memo(({ data, selected }: NodeProps) => {
  const d = data as { label?: string; config?: { expression?: string } };
  return nodeBase(
    <GitBranch size={14} />,
    d.label ?? "Condition",
    "green-400",
    !!selected,
    <div className="text-zinc-500 font-mono truncate max-w-[140px]">
      {d.config?.expression || "No expression"}
    </div>,
    <>
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        style={{ left: "30%" }}
        className="!bg-green-500 !border-green-400 !w-3 !h-3"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        style={{ left: "70%" }}
        className="!bg-red-500 !border-red-400 !w-3 !h-3"
      />
    </>
  );
});
ConditionNode.displayName = "ConditionNode";

export const nodeTypes = {
  trigger: TriggerNode,
  httpRequest: HttpRequestNode,
  jsonTransform: JsonTransformNode,
  condition: ConditionNode,
};

export function defaultNodeData(type: string): Record<string, unknown> {
  switch (type) {
    case "trigger":
      return { label: "Trigger", config: { description: "" } };
    case "httpRequest":
      return { label: "HTTP Request", config: { url: "", method: "GET", headers: {} } };
    case "jsonTransform":
      return { label: "JSON Transform", config: { mapping: {} } };
    case "condition":
      return { label: "Condition", config: { expression: "" } };
    default:
      return { label: type, config: {} };
  }
}
