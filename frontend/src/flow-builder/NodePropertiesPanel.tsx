import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Plus, Trash2, Bot, Cpu, ChevronDown } from "lucide-react";
import { type Node } from "@xyflow/react";
import { credentialsApi, type Credential } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ── Types ─────────────────────────────────────────────────────────────────────

interface InputParam {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  description: string;
}

interface Props {
  node: Node;
  projectId: string;
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
  script:        "Script (JS)",
  postgres:      "PostgreSQL",
  mysql:         "MySQL",
  mongodb:       "MongoDB",
};

// ── Shared primitives ─────────────────────────────────────────────────────────

function Field({ label, children, hint }: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-zinc-400 mb-1.5 font-medium">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-zinc-600 mt-1 leading-relaxed">{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, mono }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 ${mono ? "font-mono text-xs" : ""}`}
    />
  );
}

function TextArea({ value, onChange, rows = 5, placeholder, mono = true }: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      spellCheck={false}
      placeholder={placeholder}
      className={`w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none ${mono ? "font-mono text-xs" : "text-sm"}`}
    />
  );
}

function SelectInput({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-100 text-sm h-9 focus:ring-zinc-600 focus:ring-offset-zinc-950">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ── Template ref hint ─────────────────────────────────────────────────────────

function TemplateHint() {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs text-zinc-500 hover:text-zinc-400 transition"
      >
        <span className="font-medium">Template references</span>
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1 border-t border-zinc-800 pt-2">
          {[
            ["{{input.field}}", "Input from the AI agent"],
            ["{{nodes.id.outputs.field}}", "Output from another node"],
            ["{{env.VAR_NAME}}", "Environment variable"],
            ["{{credentials.name.field}}", "Stored credential"],
          ].map(([ref, desc]) => (
            <div key={ref} className="flex items-center gap-2">
              <code className="text-[11px] text-zinc-300 font-mono bg-zinc-800 px-1.5 py-0.5 rounded">{ref}</code>
              <span className="text-[11px] text-zinc-600">{desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Credential picker ─────────────────────────────────────────────────────────

function credentialRef(cred: Credential): string {
  switch (cred.type) {
    case "api_key":      return `{{credentials.${cred.name}.key}}`;
    case "bearer_token": return `{{credentials.${cred.name}.token}}`;
    case "basic_auth":   return `{{credentials.${cred.name}.username}}`;
    case "db_url":       return `{{credentials.${cred.name}.url}}`;
    default:             return `{{credentials.${cred.name}}}`;
  }
}

function CredentialPicker({ projectId, value, onChange, filter, label = "Credential" }: {
  projectId: string;
  value: string;
  onChange: (v: string) => void;
  filter?: string[];
  label?: string;
}) {
  const { data: creds = [] } = useQuery({
    queryKey: ["credentials", projectId],
    queryFn: () => credentialsApi.list(projectId),
  });

  const filtered = filter ? creds.filter((c) => filter.includes(c.type)) : creds;

  const selectedRef = filtered.find((c) => credentialRef(c) === value || c.name === value);

  if (filtered.length === 0) {
    return (
      <Field label={label}>
        <div className="bg-zinc-900 border border-dashed border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-500">
          No credentials saved — add them via{" "}
          <span className="text-zinc-400 font-medium">Credentials</span> in the toolbar.
        </div>
      </Field>
    );
  }

  const MANUAL = "__manual__";
  const selectValue = selectedRef ? credentialRef(selectedRef) : (value ? value : MANUAL);

  return (
    <Field label={label} hint="Saved credentials are injected at runtime — never exposed to the AI.">
      <Select
        value={selectValue}
        onValueChange={(v) => onChange(v === MANUAL ? "" : v)}
      >
        <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-100 text-sm h-9 focus:ring-zinc-600 focus:ring-offset-zinc-950">
          <SelectValue placeholder="— Type manually —" />
        </SelectTrigger>
        <SelectContent className="bg-zinc-900 border-zinc-700 text-zinc-100">
          <SelectItem value={MANUAL} className="text-zinc-500 focus:bg-zinc-800 focus:text-zinc-100">
            — Type manually —
          </SelectItem>
          {filtered.map((c) => (
            <SelectItem key={c.id} value={credentialRef(c)} className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
              {c.name} <span className="text-zinc-500">({c.type})</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

// ── Key-value editor ──────────────────────────────────────────────────────────

function KVEditor({ value, onChange, keyPlaceholder = "key", valuePlaceholder = "value" }: {
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const entries = Object.entries(value);

  function updateEntry(idx: number, k: string, v: string) {
    const next = [...entries];
    next[idx] = [k, v];
    onChange(Object.fromEntries(next));
  }

  function removeEntry(idx: number) {
    onChange(Object.fromEntries(entries.filter((_, i) => i !== idx)));
  }

  return (
    <div className="space-y-2">
      {entries.map(([k, v], i) => (
        <div key={i} className="flex gap-1.5">
          <input
            value={k}
            onChange={(e) => updateEntry(i, e.target.value, v)}
            placeholder={keyPlaceholder}
            className="flex-1 min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
          <input
            value={v}
            onChange={(e) => updateEntry(i, k, e.target.value)}
            placeholder={valuePlaceholder}
            className="flex-1 min-w-0 bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
          <button onClick={() => removeEntry(i)} className="text-zinc-600 hover:text-red-400 transition p-1.5 shrink-0">
            <Trash2 size={11} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange({ ...value, "": "" })}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition"
      >
        <Plus size={11} />
        Add row
      </button>
    </div>
  );
}

// ── Params array editor ───────────────────────────────────────────────────────

function ParamsEditor({ value, onChange }: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      {value.map((v, i) => (
        <div key={i} className="flex gap-1.5 items-center">
          <span className="text-xs text-zinc-600 font-mono w-5 shrink-0 text-right">${i + 1}</span>
          <input
            value={v}
            onChange={(e) => {
              const next = [...value];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={`e.g. {{input.id}}`}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
          <button
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="text-zinc-600 hover:text-red-400 transition p-1.5 shrink-0"
          >
            <Trash2 size={11} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...value, ""])}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition"
      >
        <Plus size={11} />
        Add parameter
      </button>
    </div>
  );
}

// ── Node forms ────────────────────────────────────────────────────────────────

function TriggerForm({ config, onChange }: {
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  const description = (config.description as string) ?? "";
  const inputs = (config.inputs as InputParam[]) ?? [];

  function updateParam(i: number, field: keyof InputParam, val: string | boolean) {
    const next = [...inputs];
    next[i] = { ...next[i], [field]: val };
    onChange({ ...config, inputs: next });
  }

  function addParam() {
    onChange({
      ...config,
      inputs: [...inputs, { name: "", type: "string", required: true, description: "" }],
    });
  }

  function removeParam(i: number) {
    onChange({ ...config, inputs: inputs.filter((_, j) => j !== i) });
  }

  const previewCall = inputs.length > 0
    ? `tool(${inputs.map((p) => `${p.name || "…"}: ${p.type}${p.required ? "" : "?"}`).join(", ")})`
    : "tool()  — no inputs";

  return (
    <div className="space-y-5">
      <div className="bg-violet-500/10 border border-violet-500/20 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <Bot size={13} className="text-violet-400" />
          <span className="text-xs font-semibold text-violet-300">AI Tool Entry Point</span>
        </div>
        <p className="text-[11px] text-violet-300/70 leading-relaxed">
          This is where an AI agent enters the flow. The description and input parameters below define what the AI sees as a callable MCP tool — the AI reads them to decide when and how to call it.
        </p>
      </div>

      <Field
        label="Tool description"
        hint="What the AI reads to understand this tool's purpose. Be clear and specific."
      >
        <TextArea
          value={description}
          onChange={(v) => onChange({ ...config, description: v })}
          rows={3}
          mono={false}
          placeholder="e.g. Fetches a customer record by email address and returns their name, plan, and account status."
        />
      </Field>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-zinc-400 font-medium">Input parameters</label>
          <span className="text-[11px] text-zinc-600">what the AI sends</span>
        </div>

        {inputs.length === 0 ? (
          <div className="border border-dashed border-zinc-800 rounded-lg p-4 text-center mb-3">
            <p className="text-xs text-zinc-600">No inputs — the AI calls this tool with no arguments.</p>
            <p className="text-[11px] text-zinc-700 mt-1">Add parameters if the tool needs data from the AI.</p>
          </div>
        ) : (
          <div className="space-y-2 mb-3">
            {inputs.map((param, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={param.name}
                    onChange={(e) => updateParam(i, "name", e.target.value)}
                    placeholder="param_name"
                    className="flex-1 min-w-0 bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                  />
                  <Select value={param.type} onValueChange={(v) => updateParam(i, "type", v)}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100 text-xs h-7 w-28 shrink-0 focus:ring-zinc-600 focus:ring-offset-zinc-900">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700 text-zinc-100">
                      {["string", "number", "boolean", "object", "array"].map((t) => (
                        <SelectItem key={t} value={t} className="text-xs text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-1 text-[11px] text-zinc-500 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={!!param.required}
                      onChange={(e) => updateParam(i, "required", e.target.checked)}
                      className="rounded"
                    />
                    req
                  </label>
                  <button onClick={() => removeParam(i)} className="text-zinc-600 hover:text-red-400 transition shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
                <input
                  value={param.description}
                  onChange={(e) => updateParam(i, "description", e.target.value)}
                  placeholder="Description for the AI (e.g. Email address of the customer)"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                />
              </div>
            ))}
          </div>
        )}

        <button
          onClick={addParam}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition"
        >
          <Plus size={12} />
          Add input parameter
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
        <p className="text-[11px] text-zinc-500 font-medium mb-2 flex items-center gap-1.5">
          <Cpu size={11} />
          The AI agent sees this call signature
        </p>
        <code className="text-[11px] text-violet-300 font-mono">{previewCall}</code>
        <p className="text-[11px] text-zinc-700 mt-1.5">
          Use <code className="text-zinc-500">{"{{input.param_name}}"}</code> in downstream nodes to access these values.
        </p>
      </div>
    </div>
  );
}

function HttpRequestForm({ config, onChange, projectId }: {
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
  projectId: string;
}) {
  const method = (config.method as string) ?? "GET";
  const url = (config.url as string) ?? "";
  const headers = (config.headers as Record<string, string>) ?? {};
  const body = (config.body as string) ?? "";
  const credential = (config.credential as string) ?? "";

  const hasBody = ["POST", "PUT", "PATCH"].includes(method);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Field label="Method">
          <SelectInput
            value={method}
            onChange={(v) => onChange({ ...config, method: v })}
            options={[
              { value: "GET", label: "GET" },
              { value: "POST", label: "POST" },
              { value: "PUT", label: "PUT" },
              { value: "PATCH", label: "PATCH" },
              { value: "DELETE", label: "DELETE" },
            ]}
          />
        </Field>
      </div>

      <Field label="URL" hint="Supports {{input.field}} and {{credentials.name.field}}.">
        <TextInput
          value={url}
          onChange={(v) => onChange({ ...config, url: v })}
          placeholder="https://api.example.com/users/{{input.id}}"
          mono
        />
      </Field>

      <CredentialPicker
        projectId={projectId}
        value={credential}
        onChange={(v) => onChange({ ...config, credential: v })}
        filter={["api_key", "bearer_token", "basic_auth", "oauth2"]}
        label="Auth credential"
      />

      <Field label="Headers">
        <KVEditor
          value={headers}
          onChange={(v) => onChange({ ...config, headers: v })}
          keyPlaceholder="Header-Name"
          valuePlaceholder="value"
        />
      </Field>

      {hasBody && (
        <Field label="Body" hint="Supports {{input.field}} template refs.">
          <TextArea
            value={body}
            onChange={(v) => onChange({ ...config, body: v })}
            rows={5}
            placeholder={'{\n  "email": "{{input.email}}"\n}'}
          />
        </Field>
      )}

      <TemplateHint />
    </div>
  );
}

function PostgresForm({ config, onChange, projectId }: {
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
  projectId: string;
}) {
  const connectionString = (config.connection_string as string) ?? "";
  const query = (config.query as string) ?? "";
  const params = (config.params as string[]) ?? [];

  const isCredRef = connectionString.startsWith("{{credentials.");

  return (
    <div className="space-y-4">
      <CredentialPicker
        projectId={projectId}
        value={isCredRef ? connectionString : ""}
        onChange={(v) => onChange({ ...config, connection_string: v })}
        filter={["db_url", "api_key"]}
        label="Database connection"
      />

      {!isCredRef && (
        <Field label="Connection URL" hint="Or paste a connection string directly (not recommended for production).">
          <TextInput
            value={connectionString}
            onChange={(v) => onChange({ ...config, connection_string: v })}
            placeholder="postgresql://user:pass@host:5432/mydb"
            mono
          />
        </Field>
      )}

      <Field
        label="SQL query"
        hint="Use $1, $2… as placeholders. These map to the Parameters list below."
      >
        <TextArea
          value={query}
          onChange={(v) => onChange({ ...config, query: v })}
          rows={6}
          placeholder={"SELECT id, name, plan\nFROM customers\nWHERE email = $1"}
        />
      </Field>

      <Field label="Parameters" hint="Values injected as $1, $2… in order. Supports {{input.field}}.">
        <ParamsEditor value={params} onChange={(v) => onChange({ ...config, params: v })} />
      </Field>

      <TemplateHint />
    </div>
  );
}

function MySQLForm({ config, onChange, projectId }: {
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
  projectId: string;
}) {
  const connectionString = (config.connection_string as string) ?? "";
  const query = (config.query as string) ?? "";
  const params = (config.params as string[]) ?? [];

  const isCredRef = connectionString.startsWith("{{credentials.");

  return (
    <div className="space-y-4">
      <CredentialPicker
        projectId={projectId}
        value={isCredRef ? connectionString : ""}
        onChange={(v) => onChange({ ...config, connection_string: v })}
        filter={["db_url", "api_key"]}
        label="Database connection"
      />

      {!isCredRef && (
        <Field label="Connection URL">
          <TextInput
            value={connectionString}
            onChange={(v) => onChange({ ...config, connection_string: v })}
            placeholder="mysql://user:pass@host:3306/mydb"
            mono
          />
        </Field>
      )}

      <Field label="SQL query" hint="Use ? as placeholders. These map to the Parameters list below.">
        <TextArea
          value={query}
          onChange={(v) => onChange({ ...config, query: v })}
          rows={6}
          placeholder={"SELECT id, name, plan\nFROM customers\nWHERE email = ?"}
        />
      </Field>

      <Field label="Parameters" hint="Values injected as ? in order. Supports {{input.field}}.">
        <ParamsEditor value={params} onChange={(v) => onChange({ ...config, params: v })} />
      </Field>

      <TemplateHint />
    </div>
  );
}

function MongoDBForm({ config, onChange, projectId }: {
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
  projectId: string;
}) {
  const connectionString = (config.connection_string as string) ?? "";
  const database = (config.database as string) ?? "";
  const collection = (config.collection as string) ?? "";
  const operation = (config.operation as string) ?? "find";
  const filterRaw = config.filter;
  const filterText = typeof filterRaw === "string"
    ? filterRaw
    : JSON.stringify(filterRaw ?? {}, null, 2);
  const limit = (config.limit as number) ?? 10;

  const isCredRef = connectionString.startsWith("{{credentials.");

  function setFilter(v: string) {
    try {
      onChange({ ...config, filter: JSON.parse(v) });
    } catch {
      onChange({ ...config, filter: v });
    }
  }

  return (
    <div className="space-y-4">
      <CredentialPicker
        projectId={projectId}
        value={isCredRef ? connectionString : ""}
        onChange={(v) => onChange({ ...config, connection_string: v })}
        filter={["db_url", "api_key"]}
        label="Database connection"
      />

      {!isCredRef && (
        <Field label="Connection URI">
          <TextInput
            value={connectionString}
            onChange={(v) => onChange({ ...config, connection_string: v })}
            placeholder="mongodb://user:pass@host:27017"
            mono
          />
        </Field>
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <Field label="Database">
            <TextInput value={database} onChange={(v) => onChange({ ...config, database: v })} placeholder="mydb" />
          </Field>
        </div>
        <div className="flex-1">
          <Field label="Collection">
            <TextInput value={collection} onChange={(v) => onChange({ ...config, collection: v })} placeholder="users" />
          </Field>
        </div>
      </div>

      <Field label="Operation">
        <SelectInput
          value={operation}
          onChange={(v) => onChange({ ...config, operation: v })}
          options={[
            { value: "find",      label: "find — return multiple documents" },
            { value: "findOne",   label: "findOne — return one document" },
            { value: "insertOne", label: "insertOne — insert a document" },
            { value: "updateOne", label: "updateOne — update matching document" },
            { value: "deleteOne", label: "deleteOne — delete matching document" },
            { value: "count",     label: "count — count matching documents" },
          ]}
        />
      </Field>

      <Field
        label={operation === "insertOne" ? "Document to insert" : "Filter"}
        hint="JSON — supports {{input.field}} template refs."
      >
        <TextArea
          value={filterText}
          onChange={setFilter}
          rows={4}
          placeholder={'{\n  "email": "{{input.email}}"\n}'}
        />
      </Field>

      {operation === "find" && (
        <Field label="Limit">
          <input
            type="number"
            value={limit}
            min={1}
            max={1000}
            onChange={(e) => onChange({ ...config, limit: parseInt(e.target.value) || 10 })}
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
          />
        </Field>
      )}

      <TemplateHint />
    </div>
  );
}

function JsonTransformForm({ config, onChange }: {
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  const mapping = (config.mapping as Record<string, string>) ?? {};

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Map fields from previous nodes into a new shape. The <span className="text-zinc-400 font-medium">output key</span> is the field name in the result; the value is an expression.
        </p>
      </div>

      <Field label="Field mappings" hint="Left: output field name  ·  Right: expression or static value">
        <KVEditor
          value={mapping}
          onChange={(v) => onChange({ ...config, mapping: v })}
          keyPlaceholder="output_field"
          valuePlaceholder="{{input.source_field}}"
        />
      </Field>

      <TemplateHint />
    </div>
  );
}

function ConditionForm({ config, onChange }: {
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  const left = (config.left as string) ?? "";
  const operator = (config.operator as string) ?? "eq";
  const right = (config.right as string) ?? "";

  return (
    <div className="space-y-4">
      <Field label="Left value" hint="Expression or field reference to compare.">
        <TextInput
          value={left}
          onChange={(v) => onChange({ ...config, left: v })}
          placeholder="{{input.status}}"
          mono
        />
      </Field>

      <Field label="Operator">
        <SelectInput
          value={operator}
          onChange={(v) => onChange({ ...config, operator: v })}
          options={[
            { value: "eq",         label: "== equals" },
            { value: "ne",         label: "!= not equals" },
            { value: "gt",         label: "> greater than" },
            { value: "gte",        label: ">= greater or equal" },
            { value: "lt",         label: "< less than" },
            { value: "lte",        label: "<= less or equal" },
            { value: "contains",   label: "contains (substring / array)" },
            { value: "startsWith", label: "starts with" },
            { value: "endsWith",   label: "ends with" },
          ]}
        />
      </Field>

      <Field label="Right value" hint="Value to compare against. Can be a literal or expression.">
        <TextInput
          value={right}
          onChange={(v) => onChange({ ...config, right: v })}
          placeholder="active"
          mono
        />
      </Field>

      <div className="flex gap-4 text-xs bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
        <span className="text-emerald-400 font-medium">✓ true  →  left branch</span>
        <span className="text-red-400 font-medium">✗ false  →  right branch</span>
      </div>
    </div>
  );
}

function VariableForm({ config, onChange }: {
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  const value = String(config.value ?? "");

  return (
    <div className="space-y-4">
      <Field label="Value" hint="Static value or expression. Accessible via {{nodes.id.outputs.value}} in later nodes.">
        <TextInput
          value={value}
          onChange={(v) => onChange({ ...config, value: v })}
          placeholder="{{input.myField}} or a static value"
          mono
        />
      </Field>
      <TemplateHint />
    </div>
  );
}

function LoopForm({ config, onChange }: {
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  const items = (config.items as string) ?? "";
  const field = (config.field as string) ?? "";

  return (
    <div className="space-y-4">
      <Field label="Items expression" hint="Expression that resolves to an array to iterate over.">
        <TextInput
          value={items}
          onChange={(v) => onChange({ ...config, items: v })}
          placeholder="{{nodes.req.outputs.body.results}}"
          mono
        />
      </Field>

      <Field label="Extract field" hint="Optional — pluck this field from each item. Leave blank to pass each item whole.">
        <TextInput
          value={field}
          onChange={(v) => onChange({ ...config, field: v })}
          placeholder="id"
        />
      </Field>

      <TemplateHint />
    </div>
  );
}

function MergeForm({ config, onChange }: {
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  const fields = Object.fromEntries(
    Object.entries(config).filter(([k]) => k !== "label").map(([k, v]) => [k, String(v)])
  );

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Combine values from multiple sources into one object. Each row becomes a field in the merged output.
        </p>
      </div>

      <Field label="Fields to merge">
        <KVEditor
          value={fields}
          onChange={(v) => onChange(v)}
          keyPlaceholder="output_key"
          valuePlaceholder="{{nodes.id.outputs.value}}"
        />
      </Field>

      <TemplateHint />
    </div>
  );
}

function ScriptForm({ config, onChange }: {
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
}) {
  const code = (config.code as string) ?? "";
  const input = (config.input as string) ?? "";

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          JavaScript executed server-side. The variable <code className="text-zinc-300">input</code> holds the data from the expression below. Return a value to pass to the next node.
        </p>
      </div>

      <Field label="Input expression" hint="What to bind to 'input'. Leave blank to use the previous node's output.">
        <TextInput
          value={input}
          onChange={(v) => onChange({ ...config, input: v })}
          placeholder="{{nodes.prev.outputs.body}}"
          mono
        />
      </Field>

      <Field label="JavaScript">
        <TextArea
          value={code}
          onChange={(v) => onChange({ ...config, code: v })}
          rows={10}
          placeholder={"// 'input' is available\n// return the result\nreturn {\n  name: input.name.toUpperCase()\n}"}
        />
      </Field>

      <TemplateHint />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NodePropertiesPanel({ node, projectId, onUpdate, onClose }: Props) {
  const data = node.data as { label?: string; config?: Record<string, unknown> };
  const [label, setLabel] = useState(data.label ?? "");
  const [config, setConfig] = useState<Record<string, unknown>>(data.config ?? {});

  useEffect(() => {
    setLabel(data.label ?? "");
    setConfig(data.config ?? {});
  }, [node.id]);

  function handleConfigChange(newConfig: Record<string, unknown>) {
    setConfig(newConfig);
    onUpdate(node.id, { ...data, label, config: newConfig });
  }

  function handleLabelChange(newLabel: string) {
    setLabel(newLabel);
    onUpdate(node.id, { ...data, label: newLabel, config });
  }

  const nodeType = node.type ?? "";

  function renderForm() {
    switch (nodeType) {
      case "trigger":
        return <TriggerForm config={config} onChange={handleConfigChange} />;
      case "httpRequest":
        return <HttpRequestForm config={config} onChange={handleConfigChange} projectId={projectId} />;
      case "postgres":
        return <PostgresForm config={config} onChange={handleConfigChange} projectId={projectId} />;
      case "mysql":
        return <MySQLForm config={config} onChange={handleConfigChange} projectId={projectId} />;
      case "mongodb":
        return <MongoDBForm config={config} onChange={handleConfigChange} projectId={projectId} />;
      case "jsonTransform":
        return <JsonTransformForm config={config} onChange={handleConfigChange} />;
      case "condition":
        return <ConditionForm config={config} onChange={handleConfigChange} />;
      case "variable":
        return <VariableForm config={config} onChange={handleConfigChange} />;
      case "loop":
        return <LoopForm config={config} onChange={handleConfigChange} />;
      case "merge":
        return <MergeForm config={config} onChange={handleConfigChange} />;
      case "script":
        return <ScriptForm config={config} onChange={handleConfigChange} />;
      default:
        return <p className="text-xs text-zinc-500">No form for node type "{nodeType}".</p>;
    }
  }

  return (
    <div className="w-80 border-l border-zinc-800 bg-zinc-950 flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <div>
          <p className="text-sm font-semibold text-zinc-100">
            {TYPE_LABELS[nodeType] ?? nodeType}
          </p>
          <p className="text-[11px] text-zinc-600 font-mono mt-0.5">{node.id.slice(0, 8)}…</p>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition">
          <X size={15} />
        </button>
      </div>

      {/* Label */}
      <div className="px-4 py-3 border-b border-zinc-800 shrink-0">
        <label className="block text-[11px] text-zinc-500 mb-1 font-medium uppercase tracking-wider">Node label</label>
        <input
          value={label}
          onChange={(e) => handleLabelChange(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
        />
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {renderForm()}
      </div>
    </div>
  );
}
