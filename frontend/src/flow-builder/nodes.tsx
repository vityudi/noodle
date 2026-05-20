import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Globe, Braces, GitBranch, Zap } from "lucide-react";

// ── handle style ───────────────────────────────────────────────────────────
const handle =
  "!w-3 !h-3 !rounded-full !border-2 !transition-colors";

// ── shared card shell ──────────────────────────────────────────────────────
interface CardProps {
  accent: string;        // tailwind bg class for the icon bg
  iconColor: string;     // tailwind text class
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  ring: string;          // selected ring color class
  children?: React.ReactNode;
  extraHandles?: React.ReactNode;
}

function NodeCard({ accent, iconColor, icon, label, selected, ring, children, extraHandles }: CardProps) {
  return (
    <div
      className={`
        relative min-w-[210px] rounded-xl shadow-xl
        border bg-[#18181b]
        transition-all duration-150
        ${selected
          ? `${ring} shadow-lg`
          : "border-white/[0.07] hover:border-white/[0.14]"}
      `}
    >
      {/* header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className={`flex items-center justify-center w-6 h-6 rounded-md ${accent} ${iconColor} shrink-0`}>
          {icon}
        </span>
        <span className="text-[13px] font-semibold text-zinc-100 leading-none truncate">
          {label}
        </span>
      </div>

      {/* body */}
      {children && (
        <div className="px-3 pb-2.5 text-[11px] text-zinc-400 space-y-1 border-t border-white/[0.05] pt-2">
          {children}
        </div>
      )}

      <Handle
        type="target"
        position={Position.Top}
        className={`${handle} !bg-zinc-700 !border-zinc-500`}
      />
      {extraHandles ?? (
        <Handle
          type="source"
          position={Position.Bottom}
          className={`${handle} !bg-zinc-700 !border-zinc-500`}
        />
      )}
    </div>
  );
}

// ── trigger ────────────────────────────────────────────────────────────────
export const TriggerNode = memo(({ data, selected }: NodeProps) => {
  const d = data as { label?: string; config?: { description?: string } };
  return (
    <div
      className={`
        relative min-w-[210px] rounded-xl shadow-xl border bg-[#18181b]
        transition-all duration-150
        ${selected ? "border-violet-500/60 shadow-violet-900/30" : "border-white/[0.07] hover:border-white/[0.14]"}
      `}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="flex items-center justify-center w-6 h-6 rounded-md bg-violet-500/20 text-violet-400 shrink-0">
          <Zap size={13} />
        </span>
        <span className="text-[13px] font-semibold text-zinc-100 leading-none">
          {d.label ?? "Trigger"}
        </span>
      </div>
      {d.config?.description && (
        <div className="px-3 pb-2.5 text-[11px] text-zinc-400 border-t border-white/[0.05] pt-2">
          {d.config.description}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className={`${handle} !bg-violet-600 !border-violet-400`} />
    </div>
  );
});
TriggerNode.displayName = "TriggerNode";

// ── http request ───────────────────────────────────────────────────────────
export const HttpRequestNode = memo(({ data, selected }: NodeProps) => {
  const d = data as { label?: string; config?: { url?: string; method?: string } };
  const method = d.config?.method ?? "GET";
  const url = d.config?.url ?? "";

  const methodColor: Record<string, string> = {
    GET: "text-sky-400", POST: "text-green-400",
    PUT: "text-amber-400", DELETE: "text-red-400", PATCH: "text-orange-400",
  };

  return (
    <NodeCard
      accent="bg-sky-500/15" iconColor="text-sky-400"
      icon={<Globe size={13} />}
      label={d.label ?? "HTTP Request"}
      selected={!!selected} ring="border-sky-500/50 shadow-sky-900/20"
    >
      <div className="flex items-center gap-1.5">
        <span className={`font-mono font-bold ${methodColor[method] ?? "text-zinc-400"}`}>{method}</span>
        <span className="truncate text-zinc-500 max-w-[130px]">{url || "No URL"}</span>
      </div>
    </NodeCard>
  );
});
HttpRequestNode.displayName = "HttpRequestNode";

// ── json transform ─────────────────────────────────────────────────────────
export const JsonTransformNode = memo(({ data, selected }: NodeProps) => {
  const d = data as { label?: string; config?: { mapping?: object } };
  const keys = Object.keys(d.config?.mapping ?? {});
  return (
    <NodeCard
      accent="bg-amber-500/15" iconColor="text-amber-400"
      icon={<Braces size={13} />}
      label={d.label ?? "JSON Transform"}
      selected={!!selected} ring="border-amber-500/50 shadow-amber-900/20"
    >
      {keys.length > 0
        ? <span className="text-zinc-500">{keys.length} field{keys.length !== 1 ? "s" : ""} mapped</span>
        : <span className="text-zinc-600 italic">No mappings defined</span>}
    </NodeCard>
  );
});
JsonTransformNode.displayName = "JsonTransformNode";

// ── condition ──────────────────────────────────────────────────────────────
export const ConditionNode = memo(({ data, selected }: NodeProps) => {
  const d = data as { label?: string; config?: { left?: string; operator?: string; right?: string } };
  const preview = d.config?.left
    ? `${d.config.left} ${d.config.operator ?? "?"} ${d.config.right ?? ""}`
    : "No condition set";
  return (
    <NodeCard
      accent="bg-emerald-500/15" iconColor="text-emerald-400"
      icon={<GitBranch size={13} />}
      label={d.label ?? "Condition"}
      selected={!!selected} ring="border-emerald-500/50 shadow-emerald-900/20"
      extraHandles={
        <>
          <Handle type="target" position={Position.Top} className={`${handle} !bg-zinc-700 !border-zinc-500`} />
          <Handle type="source" position={Position.Bottom} id="true" style={{ left: "28%" }}
            className={`${handle} !bg-emerald-600 !border-emerald-400`} />
          <Handle type="source" position={Position.Bottom} id="false" style={{ left: "72%" }}
            className={`${handle} !bg-red-600 !border-red-400`} />
        </>
      }
    >
      <span className="font-mono truncate text-zinc-500 block max-w-[170px]">{preview}</span>
      <div className="flex gap-3 mt-0.5">
        <span className="text-emerald-500 text-[10px]">✓ true</span>
        <span className="text-red-500 text-[10px]">✗ false</span>
      </div>
    </NodeCard>
  );
});
ConditionNode.displayName = "ConditionNode";

// ── registry ───────────────────────────────────────────────────────────────
export const nodeTypes = {
  trigger: TriggerNode,
  httpRequest: HttpRequestNode,
  jsonTransform: JsonTransformNode,
  condition: ConditionNode,
};

export function defaultNodeData(type: string): Record<string, unknown> {
  switch (type) {
    case "trigger":      return { label: "Trigger",        config: { description: "" } };
    case "httpRequest":  return { label: "HTTP Request",   config: { url: "", method: "GET", headers: {} } };
    case "jsonTransform":return { label: "JSON Transform", config: { mapping: {} } };
    case "condition":    return { label: "Condition",      config: { left: "", operator: "eq", right: "" } };
    default:             return { label: type, config: {} };
  }
}
