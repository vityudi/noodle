import { useState } from "react";
import { X, Check, Copy, ExternalLink, Loader2, Eye, EyeOff, Wifi, WifiOff } from "lucide-react";
import axios from "axios";
import {
  flowsApi,
  envApi,
  credentialsApi,
  type FlowTemplate,
  type Project,
  type TemplateInput,
} from "@/lib/api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = err.response?.data?.error as string | undefined;
    if (msg) return msg;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}

// ── DSN helpers ───────────────────────────────────────────────────────────────

type DbType = "postgres" | "mysql" | "mongodb";

interface DbFields {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

const defaultPort: Record<DbType, string> = {
  postgres: "5432",
  mysql: "3306",
  mongodb: "27017",
};

function defaultFields(type: DbType): DbFields {
  return { host: "localhost", port: defaultPort[type], user: "", password: "", database: "" };
}

function buildDSN(type: DbType, f: DbFields): string {
  const { host, port, user, password, database } = f;
  if (type === "mysql") {
    return `${user}:${password}@tcp(${host}:${port})/${database}`;
  }
  const scheme = type === "mongodb" ? "mongodb" : "postgres";
  const u = encodeURIComponent(user);
  const p = encodeURIComponent(password);
  return `${scheme}://${u}:${p}@${host}:${port}/${database}`;
}

function parseDSN(type: DbType, dsn: string): DbFields {
  const defaults = defaultFields(type);
  if (!dsn) return defaults;
  try {
    if (type === "mysql") {
      const m = dsn.match(/^([^:]*):([^@]*)@tcp\(([^:)]+):(\d+)\)\/(.*)$/);
      if (m) {
        return { user: m[1], password: m[2], host: m[3], port: m[4], database: m[5] };
      }
      return defaults;
    }
    const url = new URL(dsn);
    return {
      host: url.hostname || defaults.host,
      port: url.port || defaults.port,
      user: decodeURIComponent(url.username) || defaults.user,
      password: decodeURIComponent(url.password) || defaults.password,
      database: (url.pathname || "/").slice(1) || defaults.database,
    };
  } catch {
    return defaults;
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SecretInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500 pr-9"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
      >
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

function PlainInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
    />
  );
}

type TestStatus = "idle" | "loading" | "ok" | "error";

function TestButton({
  connectionType,
  connectionString,
  projectId,
}: {
  connectionType: DbType;
  connectionString: string;
  projectId: string;
}) {
  const [status, setStatus] = useState<TestStatus>("idle");
  const [result, setResult] = useState<{ latency_ms?: number; error?: string } | null>(null);

  async function handleTest() {
    if (!connectionString.trim() || !projectId) return;
    setStatus("loading");
    setResult(null);
    try {
      const r = await credentialsApi.testConnection(projectId, connectionType, connectionString);
      if (r.ok) {
        setStatus("ok");
        setResult({ latency_ms: r.latency_ms });
      } else {
        setStatus("error");
        setResult({ error: r.error });
      }
    } catch (err) {
      setStatus("error");
      setResult({ error: extractErrorMessage(err) });
    }
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={handleTest}
        disabled={!connectionString.trim() || status === "loading"}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {status === "loading" ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Wifi size={12} />
        )}
        Test connection
      </button>

      {status === "ok" && result && (
        <p className="text-xs text-emerald-400 flex items-center gap-1">
          <Check size={11} />
          Connected{result.latency_ms !== undefined ? ` (${result.latency_ms}ms)` : ""}
        </p>
      )}
      {status === "error" && result?.error && (
        <p className="text-xs text-red-400 flex items-center gap-1.5">
          <WifiOff size={11} className="shrink-0" />
          <span className="break-all">{result.error}</span>
        </p>
      )}
    </div>
  );
}

type ConnMode = "dsn" | "fields";

function ConnectionInput({
  connectionType,
  value,
  onChange,
  placeholder,
  projectId,
}: {
  connectionType: DbType;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  projectId: string;
}) {
  const [mode, setMode] = useState<ConnMode>("dsn");
  const [fields, setFields] = useState<DbFields>(() => parseDSN(connectionType, value));

  function switchMode(next: ConnMode) {
    if (next === "fields" && mode === "dsn") {
      setFields(parseDSN(connectionType, value));
    }
    if (next === "dsn" && mode === "fields") {
      onChange(buildDSN(connectionType, fields));
    }
    setMode(next);
  }

  function updateField(key: keyof DbFields, val: string) {
    const next = { ...fields, [key]: val };
    setFields(next);
    onChange(buildDSN(connectionType, next));
  }

  return (
    <div className="space-y-2">
      {/* Mode toggle */}
      <div className="flex gap-1 p-0.5 bg-zinc-800 border border-zinc-700 rounded-lg w-fit">
        {(["dsn", "fields"] as ConnMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
              mode === m
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {m === "dsn" ? "Connection string" : "Fill fields"}
          </button>
        ))}
      </div>

      {/* DSN mode */}
      {mode === "dsn" && (
        <SecretInput value={value} onChange={onChange} placeholder={placeholder} />
      )}

      {/* Fields mode */}
      {mode === "fields" && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-[11px] text-zinc-500 block mb-1">Host</label>
              <PlainInput
                value={fields.host}
                onChange={(v) => updateField("host", v)}
                placeholder="localhost"
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 block mb-1">Port</label>
              <PlainInput
                value={fields.port}
                onChange={(v) => updateField("port", v)}
                placeholder={defaultPort[connectionType]}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-zinc-500 block mb-1">User</label>
              <PlainInput
                value={fields.user}
                onChange={(v) => updateField("user", v)}
                placeholder="myuser"
              />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 block mb-1">Password</label>
              <SecretInput
                value={fields.password}
                onChange={(v) => updateField("password", v)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-zinc-500 block mb-1">Database</label>
            <PlainInput
              value={fields.database}
              onChange={(v) => updateField("database", v)}
              placeholder="mydb"
            />
          </div>
        </div>
      )}

      {/* Test button */}
      <TestButton
        connectionType={connectionType}
        connectionString={value}
        projectId={projectId}
      />
    </div>
  );
}

function FieldInput({
  input,
  value,
  onChange,
}: {
  input: TemplateInput;
  value: string;
  onChange: (v: string) => void;
}) {
  if (input.type === "secret") {
    return (
      <SecretInput value={value} onChange={onChange} placeholder={input.placeholder} />
    );
  }
  return (
    <PlainInput
      type={input.type === "url" ? "url" : "text"}
      value={value}
      onChange={onChange}
      placeholder={input.placeholder}
    />
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  template: FlowTemplate;
  projects: Project[];
  onClose: () => void;
}

type Step = "configure" | "creating" | "done";

interface InputValues {
  [key: string]: string;
}

export function TemplateWizard({ template, projects, onClose }: Props) {
  const [step, setStep] = useState<Step>("configure");
  const [flowName, setFlowName] = useState(
    template.name.toLowerCase().replace(/\s+/g, "_")
  );
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? "");
  const [values, setValues] = useState<InputValues>(() =>
    Object.fromEntries(template.inputs.map((i) => [i.key, ""]))
  );
  const [mcpUrl, setMcpUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  function setValue(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  function isValid() {
    if (!flowName.trim() || !selectedProjectId) return false;
    return template.inputs.every((i) => !i.required || values[i.key]?.trim());
  }

  async function handleCreate() {
    setStep("creating");
    setError(null);
    try {
      // Env vars — skip silently if key already exists
      const envInputs = template.inputs.filter((i) => i.target === "env");
      for (const input of envInputs) {
        const val = values[input.key].trim();
        if (!val) continue;
        try {
          await envApi.create(selectedProjectId, { key: input.key, value: val, is_secret: false });
        } catch (err) {
          if (!(axios.isAxiosError(err) && err.response?.status === 409)) throw err;
        }
      }

      // Credentials — upsert (backend handles ON CONFLICT DO UPDATE)
      const credInputs = template.inputs.filter((i) => i.target === "credential");
      for (const input of credInputs) {
        const val = values[input.key].trim();
        if (!val) continue;
        const field = input.credential_field ?? "token";
        await credentialsApi.create(selectedProjectId, {
          name: input.key,
          type: "api_key",
          data: { [field]: val },
        });
      }

      // Create the flow
      await flowsApi.create(selectedProjectId, {
        name: flowName.trim(),
        description: template.description,
        flow_json: template.flow,
      });

      const slug = selectedProject?.slug ?? selectedProjectId;
      setMcpUrl(`${API_BASE}/mcp/${slug}/sse`);
      setStep("done");
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
      setStep("configure");
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(mcpUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-5">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">{template.name}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{template.description}</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition ml-4 shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 pb-6">
          {/* Step: configure */}
          {step === "configure" && (
            <div className="space-y-4">
              {/* Project selector */}
              {projects.length > 1 && (
                <div>
                  <label className="text-xs font-medium text-zinc-400 block mb-1.5">Project</label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Flow name */}
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1.5">Tool name</label>
                <input
                  value={flowName}
                  onChange={(e) => setFlowName(e.target.value)}
                  placeholder="my_tool"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-500"
                />
                <p className="text-[11px] text-zinc-600 mt-1">
                  This is how Claude will identify the tool.
                </p>
              </div>

              {/* Template-specific inputs */}
              {template.inputs.map((input) => (
                <div key={input.key}>
                  <label className="text-xs font-medium text-zinc-400 block mb-1.5">
                    {input.label}
                    {input.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>

                  {input.connection_type ? (
                    <ConnectionInput
                      connectionType={input.connection_type}
                      value={values[input.key]}
                      onChange={(v) => setValue(input.key, v)}
                      placeholder={input.placeholder}
                      projectId={selectedProjectId}
                    />
                  ) : (
                    <FieldInput
                      input={input}
                      value={values[input.key]}
                      onChange={(v) => setValue(input.key, v)}
                    />
                  )}

                  {input.description && (
                    <p className="text-[11px] text-zinc-600 mt-1">{input.description}</p>
                  )}
                </div>
              ))}

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-zinc-200 hover:border-zinc-600 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!isValid()}
                  className="flex-1 px-4 py-2 rounded-lg bg-white text-zinc-900 text-sm font-medium hover:bg-zinc-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Create tool
                </button>
              </div>
            </div>
          )}

          {/* Step: creating */}
          {step === "creating" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 size={24} className="text-zinc-400 animate-spin" />
              <p className="text-sm text-zinc-400">Setting up your tool…</p>
            </div>
          )}

          {/* Step: done */}
          {step === "done" && (
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-2 py-2">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Check size={18} className="text-emerald-400" />
                </div>
                <p className="text-sm font-medium text-zinc-200">Tool created</p>
                <p className="text-xs text-zinc-500 text-center">
                  Add the URL below to Claude's MCP settings to connect.
                </p>
              </div>

              {/* MCP URL */}
              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-1.5">
                  MCP Server URL
                </label>
                <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2">
                  <code className="text-xs text-zinc-300 flex-1 truncate">{mcpUrl}</code>
                  <button
                    onClick={copyUrl}
                    className="shrink-0 text-zinc-500 hover:text-zinc-200 transition"
                    title="Copy URL"
                  >
                    {copied ? (
                      <Check size={14} className="text-emerald-400" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>
              </div>

              {/* How to connect */}
              <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4 space-y-2">
                <p className="text-xs font-medium text-zinc-300">How to connect</p>
                <ol className="text-xs text-zinc-500 space-y-1.5 list-decimal list-inside">
                  <li>Open Claude → Settings → MCP Servers</li>
                  <li>
                    Click <span className="text-zinc-300">Add server</span> and choose SSE
                  </li>
                  <li>Paste the URL above and save</li>
                </ol>
                <a
                  href="https://modelcontextprotocol.io/docs/quickstart/user"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition mt-1"
                >
                  MCP setup guide <ExternalLink size={10} />
                </a>
              </div>

              <button
                onClick={onClose}
                className="w-full px-4 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-sm hover:bg-zinc-700 transition"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
