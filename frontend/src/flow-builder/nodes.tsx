import { memo } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { Globe, Braces, GitBranch, Zap, Trash2, Box, Repeat, Combine, Code2, Database } from "lucide-react";

function DeleteButton({ id }: { id: string }) {
  const { deleteElements } = useReactFlow();
  return (
    <button
      onClick={(e) => { e.stopPropagation(); deleteElements({ nodes: [{ id }] }); }}
      className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto p-0.5 rounded text-zinc-600 hover:text-zinc-100 hover:bg-white/10"
    >
      <Trash2 size={11} />
    </button>
  );
}

// ── handle style ───────────────────────────────────────────────────────────
const handle =
  "!w-3 !h-3 !rounded-full !border-2 !transition-colors";

// ── shared card shell ──────────────────────────────────────────────────────
interface CardProps {
  id: string;
  accent: string;
  iconColor: string;
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  ring: string;
  children?: React.ReactNode;
  extraHandles?: React.ReactNode;
}

function NodeCard({ id, accent, iconColor, icon, label, selected, ring, children, extraHandles }: CardProps) {
  return (
    <div
      className={`
        group relative min-w-[210px] rounded-xl shadow-xl
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
        <span className="text-[13px] font-semibold text-zinc-100 leading-none truncate flex-1">
          {label}
        </span>
        <DeleteButton id={id} />
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
export const TriggerNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as { label?: string; config?: { description?: string } };
  return (
    <div
      className={`
        group relative min-w-[210px] rounded-xl shadow-xl border bg-[#18181b]
        transition-all duration-150
        ${selected ? "border-violet-500/60 shadow-violet-900/30" : "border-white/[0.07] hover:border-white/[0.14]"}
      `}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="flex items-center justify-center w-6 h-6 rounded-md bg-violet-500/20 text-violet-400 shrink-0">
          <Zap size={13} />
        </span>
        <span className="text-[13px] font-semibold text-zinc-100 leading-none flex-1">
          {d.label ?? "Trigger"}
        </span>
        <DeleteButton id={id} />
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
export const HttpRequestNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as { label?: string; config?: { url?: string; method?: string } };
  const method = d.config?.method ?? "GET";
  const url = d.config?.url ?? "";

  const methodColor: Record<string, string> = {
    GET: "text-sky-400", POST: "text-green-400",
    PUT: "text-amber-400", DELETE: "text-red-400", PATCH: "text-orange-400",
  };

  return (
    <NodeCard
      id={id}
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
export const JsonTransformNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as { label?: string; config?: { mapping?: object } };
  const keys = Object.keys(d.config?.mapping ?? {});
  return (
    <NodeCard
      id={id}
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
export const ConditionNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as { label?: string; config?: { left?: string; operator?: string; right?: string } };
  const preview = d.config?.left
    ? `${d.config.left} ${d.config.operator ?? "?"} ${d.config.right ?? ""}`
    : "No condition set";
  return (
    <NodeCard
      id={id}
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

// ── variable ───────────────────────────────────────────────────────────────
export const VariableNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as { label?: string; config?: { value?: unknown } };
  const val = d.config?.value;
  const preview = val !== undefined && val !== "" ? String(val) : "No value set";
  return (
    <NodeCard
      id={id}
      accent="bg-indigo-500/15" iconColor="text-indigo-400"
      icon={<Box size={13} />}
      label={d.label ?? "Variable"}
      selected={!!selected} ring="border-indigo-500/50 shadow-indigo-900/20"
    >
      <span className="font-mono truncate text-zinc-500 block max-w-[170px]">{preview}</span>
    </NodeCard>
  );
});
VariableNode.displayName = "VariableNode";

// ── loop ───────────────────────────────────────────────────────────────────
export const LoopNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as { label?: string; config?: { items?: unknown; field?: string } };
  const field = d.config?.field;
  return (
    <NodeCard
      id={id}
      accent="bg-cyan-500/15" iconColor="text-cyan-400"
      icon={<Repeat size={13} />}
      label={d.label ?? "Loop"}
      selected={!!selected} ring="border-cyan-500/50 shadow-cyan-900/20"
    >
      <span className="text-zinc-500">
        {field ? `Extract "${field}" from each item` : "Iterate over array"}
      </span>
    </NodeCard>
  );
});
LoopNode.displayName = "LoopNode";

// ── merge ──────────────────────────────────────────────────────────────────
export const MergeNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as { label?: string; config?: Record<string, unknown> };
  const keys = Object.keys(d.config ?? {});
  return (
    <NodeCard
      id={id}
      accent="bg-rose-500/15" iconColor="text-rose-400"
      icon={<Combine size={13} />}
      label={d.label ?? "Merge"}
      selected={!!selected} ring="border-rose-500/50 shadow-rose-900/20"
    >
      {keys.length > 0
        ? <span className="text-zinc-500">{keys.length} field{keys.length !== 1 ? "s" : ""} merged</span>
        : <span className="text-zinc-600 italic">No fields defined</span>}
    </NodeCard>
  );
});
MergeNode.displayName = "MergeNode";

// ── script ─────────────────────────────────────────────────────────────────
export const ScriptNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as { label?: string; config?: { code?: string } };
  const lines = (d.config?.code ?? "").split("\n").filter(Boolean).length;
  return (
    <NodeCard
      id={id}
      accent="bg-fuchsia-500/15" iconColor="text-fuchsia-400"
      icon={<Code2 size={13} />}
      label={d.label ?? "Script"}
      selected={!!selected} ring="border-fuchsia-500/50 shadow-fuchsia-900/20"
    >
      {lines > 0
        ? <span className="text-zinc-500">{lines} line{lines !== 1 ? "s" : ""} of JS</span>
        : <span className="text-zinc-600 italic">No code written</span>}
    </NodeCard>
  );
});
ScriptNode.displayName = "ScriptNode";

// ── postgres ───────────────────────────────────────────────────────────────
export const PostgresNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as { label?: string; config?: { query?: string } };
  const preview = d.config?.query?.split("\n")[0] ?? "";
  return (
    <NodeCard
      id={id}
      accent="bg-teal-500/15" iconColor="text-teal-400"
      icon={<Database size={13} />}
      label={d.label ?? "PostgreSQL"}
      selected={!!selected} ring="border-teal-500/50 shadow-teal-900/20"
    >
      {preview
        ? <span className="font-mono truncate text-zinc-500 block max-w-[170px]">{preview}</span>
        : <span className="text-zinc-600 italic">No query defined</span>}
    </NodeCard>
  );
});
PostgresNode.displayName = "PostgresNode";

// ── mysql ──────────────────────────────────────────────────────────────────
export const MySQLNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as { label?: string; config?: { query?: string } };
  const preview = d.config?.query?.split("\n")[0] ?? "";
  return (
    <NodeCard
      id={id}
      accent="bg-orange-500/15" iconColor="text-orange-400"
      icon={<Database size={13} />}
      label={d.label ?? "MySQL"}
      selected={!!selected} ring="border-orange-500/50 shadow-orange-900/20"
    >
      {preview
        ? <span className="font-mono truncate text-zinc-500 block max-w-[170px]">{preview}</span>
        : <span className="text-zinc-600 italic">No query defined</span>}
    </NodeCard>
  );
});
MySQLNode.displayName = "MySQLNode";

// ── mongodb ────────────────────────────────────────────────────────────────
export const MongoDBNode = memo(({ id, data, selected }: NodeProps) => {
  const d = data as { label?: string; config?: { operation?: string; collection?: string } };
  const op = d.config?.operation ?? "";
  const col = d.config?.collection ?? "";
  return (
    <NodeCard
      id={id}
      accent="bg-green-500/15" iconColor="text-green-400"
      icon={<Database size={13} />}
      label={d.label ?? "MongoDB"}
      selected={!!selected} ring="border-green-500/50 shadow-green-900/20"
    >
      {op
        ? <span className="text-zinc-500">{op}{col ? ` · ${col}` : ""}</span>
        : <span className="text-zinc-600 italic">No operation defined</span>}
    </NodeCard>
  );
});
MongoDBNode.displayName = "MongoDBNode";

// ── registry ───────────────────────────────────────────────────────────────
export const nodeTypes = {
  trigger:       TriggerNode,
  httpRequest:   HttpRequestNode,
  jsonTransform: JsonTransformNode,
  condition:     ConditionNode,
  variable:      VariableNode,
  loop:          LoopNode,
  merge:         MergeNode,
  script:        ScriptNode,
  postgres:      PostgresNode,
  mysql:         MySQLNode,
  mongodb:       MongoDBNode,
};

export function defaultNodeData(type: string): Record<string, unknown> {
  switch (type) {
    case "trigger":       return { label: "Trigger",        config: { description: "" } };
    case "httpRequest":   return { label: "HTTP Request",   config: { url: "", method: "GET", headers: {} } };
    case "jsonTransform": return { label: "JSON Transform", config: { mapping: {} } };
    case "condition":     return { label: "Condition",      config: { left: "", operator: "eq", right: "" } };
    case "variable":      return { label: "Variable",       config: { value: "" } };
    case "loop":          return { label: "Loop",           config: { items: "", field: "" } };
    case "merge":         return { label: "Merge",          config: {} };
    case "script":        return { label: "Script",         config: { code: "// input is available\nreturn input", input: "" } };
    case "postgres":      return { label: "PostgreSQL",     config: { connection_string: "{{credentials.mydb.url}}", query: "SELECT * FROM table_name WHERE id = $1", params: ["{{input.id}}"] } };
    case "mysql":         return { label: "MySQL",          config: { connection_string: "{{credentials.mydb.url}}", query: "SELECT * FROM table_name WHERE id = ?", params: ["{{input.id}}"] } };
    case "mongodb":       return { label: "MongoDB",        config: { connection_string: "{{credentials.mydb.url}}", database: "mydb", collection: "my_collection", operation: "find", filter: {}, limit: 10 } };
    default:              return { label: type, config: {} };
  }
}
