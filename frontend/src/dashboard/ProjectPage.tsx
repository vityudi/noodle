import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  flowsApi, credentialsApi, envApi, openAPIApi, templatesApi,
  type Flow, type Project, type Credential, type EnvVariable, type SuggestedFlow, type FlowTemplate,
} from "@/lib/api";
import {
  ChevronLeft, Plus, ArrowRight, KeyRound,
  SlidersHorizontal, Download, Trash2, Eye, EyeOff, Key, Lock,
  Check, AlertCircle, Code2, Layers, ChevronDown, Link2,
} from "lucide-react";
import { TemplateWizard } from "./TemplateWizard";
import { ConnectModal } from "./ConnectModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ProjectTab = "flows" | "credentials" | "environment" | "import";

interface Props {
  project: Project;
  tab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
  onBack: () => void;
  onOpenBuilder: () => void;
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, action }: {
  title: string;
  subtitle: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
        <p className="text-sm text-zinc-400 mt-0.5">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body, action }: {
  icon: React.ElementType;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border border-dashed border-zinc-800 rounded-xl p-14 text-center">
      <Icon size={26} className="text-zinc-700 mx-auto mb-3" />
      <p className="text-zinc-400 text-sm font-medium">{title}</p>
      <p className="text-zinc-600 text-xs mt-1 mb-4">{body}</p>
      {action}
    </div>
  );
}

// ── Flows tab ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  rest:      "bg-sky-500/10 text-sky-400 border-sky-500/20",
  transform: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  auth:      "bg-amber-500/10 text-amber-400 border-amber-500/20",
  utility:   "bg-zinc-500/10 text-zinc-400 border-zinc-700",
};


function TemplatesSection({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<FlowTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["templates"],
    queryFn: templatesApi.list,
    enabled: open,
  });

  const categories = [...new Set(templates.map((t) => t.category))];
  const filtered = activeCategory ? templates.filter((t) => t.category === activeCategory) : templates;

  return (
    <div className="mt-6 border-t border-zinc-800 pt-5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition"
      >
        <Layers size={14} />
        <span className="font-medium">Start from a template</span>
        <ChevronDown size={13} className={`ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {isLoading ? (
            <p className="text-xs text-zinc-500">Loading templates…</p>
          ) : templates.length === 0 ? (
            <p className="text-xs text-zinc-600">No templates available.</p>
          ) : (
            <>
              {categories.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setActiveCategory(null)}
                    className={`px-2.5 py-1 rounded-full text-xs border transition ${
                      activeCategory === null
                        ? "bg-zinc-700 text-zinc-100 border-zinc-600"
                        : "text-zinc-500 border-zinc-700 hover:text-zinc-300"
                    }`}
                  >
                    All
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition ${
                        activeCategory === cat
                          ? "bg-zinc-700 text-zinc-100 border-zinc-600"
                          : "text-zinc-500 border-zinc-700 hover:text-zinc-300"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {filtered.map((t) => (
                  <div
                    key={t.id}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2 hover:border-zinc-700 transition group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-100 leading-snug">{t.name}</p>
                      <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[t.category] ?? "bg-zinc-700 text-zinc-400 border-zinc-600"}`}>
                        {t.category}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 flex-1 leading-relaxed">{t.description}</p>
                    <button
                      onClick={() => setSelected(t)}
                      className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition mt-1"
                    >
                      Use template
                      <ArrowRight size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {selected && (
        <TemplateWizard
          template={selected}
          projects={[project]}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function FlowsTab({ project, onOpenBuilder }: { project: Project; onOpenBuilder: () => void }) {
  const { data: flows = [], isLoading } = useQuery({
    queryKey: ["flows", project.id],
    queryFn: () => flowsApi.list(project.id),
  });

  const flowTypeBadge = (flow: Flow) =>
    flow.flow_type === "resource"
      ? <span className="text-[10px] px-1.5 py-0.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded font-medium">resource</span>
      : <span className="text-[10px] px-1.5 py-0.5 bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded font-medium">tool</span>;

  return (
    <div>
      <SectionHeader
        title="Flows"
        subtitle="Each flow becomes an MCP tool or resource that AI agents can call."
        action={
          <button
            onClick={onOpenBuilder}
            className="flex items-center gap-2 bg-white text-zinc-900 font-medium rounded-lg px-4 py-2 text-sm hover:bg-zinc-200 transition"
          >
            <Code2 size={14} />
            Open flow builder
          </button>
        }
      />

      {isLoading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : flows.length === 0 ? (
        <>
          <EmptyState
            icon={Code2}
            title="No flows yet"
            body="Flows define the logic AI agents execute when they call a tool."
            action={
              <button
                onClick={onOpenBuilder}
                className="bg-white text-zinc-900 font-medium rounded-lg px-4 py-2 text-sm hover:bg-zinc-200 transition"
              >
                Open flow builder
              </button>
            }
          />
          <TemplatesSection project={project} />
        </>
      ) : (
        <>
          <div className="space-y-2">
            {flows.map((flow) => (
              <div
                key={flow.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-zinc-700 transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-zinc-100 truncate">{flow.name}</span>
                    {flowTypeBadge(flow)}
                  </div>
                  {flow.description && (
                    <p className="text-xs text-zinc-500 truncate">{flow.description}</p>
                  )}
                  <p className="text-[11px] text-zinc-700 mt-1">
                    Updated {new Date(flow.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={onOpenBuilder}
                  className="flex items-center gap-1.5 text-xs border border-zinc-700 text-zinc-400 rounded-lg px-3 py-1.5 hover:bg-zinc-800 hover:text-zinc-100 transition shrink-0"
                >
                  Edit
                  <ArrowRight size={12} />
                </button>
              </div>
            ))}

            <button
              onClick={onOpenBuilder}
              className="w-full mt-1 flex items-center justify-center gap-2 border border-dashed border-zinc-800 text-zinc-600 text-sm rounded-xl py-3 hover:border-zinc-700 hover:text-zinc-400 transition"
            >
              <Plus size={14} />
              New flow (open builder)
            </button>
          </div>
          <TemplatesSection project={project} />
        </>
      )}
    </div>
  );
}

// ── Credentials tab ───────────────────────────────────────────────────────────

const CREDENTIAL_TYPES = [
  { value: "api_key",      label: "API Key",      fields: [{ key: "key",    label: "API Key",        secret: true  }] },
  { value: "bearer_token", label: "Bearer Token", fields: [{ key: "token",  label: "Token",          secret: true  }] },
  { value: "db_url",       label: "Database URL", fields: [{ key: "url",    label: "Connection URL", secret: true  }] },
  {
    value: "basic_auth",
    label: "Basic Auth",
    fields: [
      { key: "username", label: "Username", secret: false },
      { key: "password", label: "Password", secret: true  },
    ],
  },
  {
    value: "oauth2",
    label: "OAuth 2.0",
    fields: [
      { key: "client_id",     label: "Client ID",     secret: false },
      { key: "client_secret", label: "Client Secret", secret: true  },
      { key: "token_url",     label: "Token URL",     secret: false },
    ],
  },
];

function credTypeLabel(type: string) {
  return CREDENTIAL_TYPES.find((t) => t.value === type)?.label ?? type;
}

function CredReveal({ projectId, cred }: { projectId: string; cred: Credential }) {
  const [data, setData] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (data) { setData(null); return; }
    setLoading(true);
    try {
      const res = await credentialsApi.reveal(projectId, cred.id);
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={toggle}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition mt-2"
      >
        {data ? <EyeOff size={12} /> : <Eye size={12} />}
        {data ? "Hide" : "Reveal"}
      </button>
      {data && (
        <div className="mt-2 bg-zinc-800 rounded-lg p-3 space-y-1">
          {Object.entries(data).map(([k, v]) => (
            <div key={k} className="flex gap-2 text-xs font-mono">
              <span className="text-zinc-500">{k}:</span>
              <span className="text-zinc-300 break-all">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddCredentialForm({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState("api_key");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const typeDef = CREDENTIAL_TYPES.find((t) => t.value === type)!;

  const mutation = useMutation({
    mutationFn: () => credentialsApi.create(projectId, { name, type, data: fields }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credentials", projectId] });
      onDone();
    },
    onError: () => setError("Name already exists or invalid."),
  });

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-zinc-100">Add credential</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-api-key"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">Type</label>
          <Select value={type} onValueChange={(v) => { setType(v); setFields({}); }}>
            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100 h-9 text-sm focus:ring-zinc-600 focus:ring-offset-zinc-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700 text-zinc-100">
              {CREDENTIAL_TYPES.map((t) => (
                <SelectItem
                  key={t.value}
                  value={t.value}
                  className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100"
                >
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {typeDef.fields.map((f) => (
          <div key={f.key}>
            <label className="block text-xs text-zinc-400 mb-1.5">{f.label}</label>
            <input
              type={f.secret ? "password" : "text"}
              value={fields[f.key] ?? ""}
              onChange={(e) => setFields((p) => ({ ...p, [f.key]: e.target.value }))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button
          onClick={onDone}
          className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded-lg transition"
        >
          Cancel
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!name || mutation.isPending}
          className="px-4 py-2 text-sm bg-white text-zinc-900 font-medium rounded-lg hover:bg-zinc-200 transition disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Save credential"}
        </button>
      </div>
    </div>
  );
}

function CredentialsTab({ project }: { project: Project }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data: creds = [], isLoading } = useQuery({
    queryKey: ["credentials", project.id],
    queryFn: () => credentialsApi.list(project.id),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => credentialsApi.delete(project.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["credentials", project.id] }),
  });

  return (
    <div>
      <SectionHeader
        title="Credentials"
        subtitle={
          <>
            Stored encrypted. Reference in flows as{" "}
            <code className="text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded text-xs">
              {"{{credentials.name.field}}"}
            </code>
          </>
        }
        action={
          !adding ? (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 bg-white text-zinc-900 font-medium rounded-lg px-4 py-2 text-sm hover:bg-zinc-200 transition"
            >
              <Plus size={14} />
              Add credential
            </button>
          ) : undefined
        }
      />

      {adding && (
        <div className="mb-4">
          <AddCredentialForm projectId={project.id} onDone={() => setAdding(false)} />
        </div>
      )}

      {isLoading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : creds.length === 0 && !adding ? (
        <EmptyState
          icon={KeyRound}
          title="No credentials yet"
          body="Add API keys, tokens, or database URLs to use them securely in flows."
          action={
            <button
              onClick={() => setAdding(true)}
              className="bg-white text-zinc-900 font-medium rounded-lg px-4 py-2 text-sm hover:bg-zinc-200 transition"
            >
              Add first credential
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {creds.map((c) => (
            <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {c.type === "api_key" || c.type === "bearer_token"
                    ? <Key size={14} className="text-zinc-500" />
                    : <Lock size={14} className="text-zinc-500" />}
                  <span className="font-medium text-sm text-zinc-100">{c.name}</span>
                  <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                    {credTypeLabel(c.type)}
                  </span>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(c.id)}
                  className="text-zinc-600 hover:text-red-400 transition"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="text-[11px] text-zinc-600 font-mono mt-1.5">
                {"{{credentials."}{c.name}.key{"}}"}
              </p>
              <CredReveal projectId={project.id} cred={c} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Environment tab ───────────────────────────────────────────────────────────

function AddEnvForm({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [isSecret, setIsSecret] = useState(false);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => envApi.create(projectId, { key, value, is_secret: isSecret }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["env", projectId] });
      onDone();
    },
    onError: () => setError("Key already exists or invalid."),
  });

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-zinc-100">Add environment variable</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">Key</label>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
            placeholder="MY_API_BASE_URL"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">Value</label>
          <input
            type={isSecret ? "password" : "text"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://api.example.com"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isSecret}
          onChange={(e) => setIsSecret(e.target.checked)}
          className="rounded border-zinc-600"
        />
        <span className="text-sm text-zinc-400">Secret (encrypted, value hidden after saving)</span>
      </label>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button
          onClick={onDone}
          className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded-lg transition"
        >
          Cancel
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!key || !value || mutation.isPending}
          className="px-4 py-2 text-sm bg-white text-zinc-900 font-medium rounded-lg hover:bg-zinc-200 transition disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Save variable"}
        </button>
      </div>
    </div>
  );
}

function EnvReveal({ projectId, envVar }: { projectId: string; envVar: EnvVariable }) {
  const [value, setValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (value !== null) { setValue(null); return; }
    setLoading(true);
    try {
      const res = await envApi.reveal(projectId, envVar.id);
      setValue(res.value);
    } finally {
      setLoading(false);
    }
  }

  if (!envVar.is_secret) return null;

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition"
    >
      {value !== null ? <EyeOff size={11} /> : <Eye size={11} />}
      {value !== null ? (
        <span className="font-mono text-zinc-400">{value}</span>
      ) : (
        "Reveal"
      )}
    </button>
  );
}

function EnvironmentTab({ project }: { project: Project }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data: vars = [], isLoading } = useQuery({
    queryKey: ["env", project.id],
    queryFn: () => envApi.list(project.id),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => envApi.delete(project.id, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["env", project.id] }),
  });

  return (
    <div>
      <SectionHeader
        title="Environment"
        subtitle={
          <>
            Custom variables for this project. Reference in flows as{" "}
            <code className="text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded text-xs">
              {"{{env.KEY_NAME}}"}
            </code>
          </>
        }
        action={
          !adding ? (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 bg-white text-zinc-900 font-medium rounded-lg px-4 py-2 text-sm hover:bg-zinc-200 transition"
            >
              <Plus size={14} />
              Add variable
            </button>
          ) : undefined
        }
      />

      {adding && (
        <div className="mb-4">
          <AddEnvForm projectId={project.id} onDone={() => setAdding(false)} />
        </div>
      )}

      {isLoading ? (
        <p className="text-zinc-500 text-sm">Loading…</p>
      ) : vars.length === 0 && !adding ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="No environment variables"
          body="Store base URLs, feature flags, or any non-secret config your flows need."
          action={
            <button
              onClick={() => setAdding(true)}
              className="bg-white text-zinc-900 font-medium rounded-lg px-4 py-2 text-sm hover:bg-zinc-200 transition"
            >
              Add first variable
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {vars.map((v) => (
            <div key={v.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-4">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-zinc-100">{v.key}</span>
                  {v.is_secret && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">secret</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-[11px] text-zinc-500 font-mono">{"{{env."}{v.key}{"}}"}</code>
                  {v.is_secret
                    ? <EnvReveal projectId={project.id} envVar={v} />
                    : null}
                </div>
              </div>
              <button
                onClick={() => deleteMutation.mutate(v.id)}
                className="text-zinc-600 hover:text-red-400 transition shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Import tab ────────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  GET:    "bg-sky-500/10 text-sky-400 border-sky-500/20",
  POST:   "bg-green-500/10 text-green-400 border-green-500/20",
  PUT:    "bg-amber-500/10 text-amber-400 border-amber-500/20",
  PATCH:  "bg-orange-500/10 text-orange-400 border-orange-500/20",
  DELETE: "bg-red-500/10 text-red-400 border-red-500/20",
};

function ImportTab({ project }: { project: Project }) {
  const qc = useQueryClient();
  const [sourceTab, setSourceTab] = useState<"url" | "paste">("url");
  const [url, setUrl] = useState("");
  const [spec, setSpec] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; endpoints: SuggestedFlow[] } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [imported, setImported] = useState(false);

  const parseMutation = useMutation({
    mutationFn: () => openAPIApi.preview(project.id, sourceTab === "url" ? { url } : { spec }),
    onSuccess: (data) => {
      setPreview(data);
      setSelected(new Set(data.endpoints.map((_, i) => i)));
      setParseError(null);
    },
    onError: (e: Error) => setParseError(e.message || "Could not parse spec."),
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!preview) return;
      const endpoints = preview.endpoints.filter((_, i) => selected.has(i));
      await Promise.all(
        endpoints.map((ep) =>
          flowsApi.create(project.id, { name: ep.name, description: ep.description, flow_json: ep.flow_json })
        )
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flows", project.id] });
      setImported(true);
      setPreview(null);
      setUrl("");
      setSpec("");
    },
  });

  function toggleAll() {
    if (!preview) return;
    setSelected(
      selected.size === preview.endpoints.length
        ? new Set()
        : new Set(preview.endpoints.map((_, i) => i))
    );
  }

  function toggleOne(i: number) {
    const next = new Set(selected);
    next.has(i) ? next.delete(i) : next.add(i);
    setSelected(next);
  }

  return (
    <div>
      <SectionHeader
        title="Import from OpenAPI"
        subtitle="Parse an OpenAPI / Swagger spec and auto-generate flows for each endpoint."
      />

      {imported && (
        <div className="mb-4 flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-xl px-4 py-3">
          <Check size={16} />
          Flows imported — open the builder to edit them.
        </div>
      )}

      {!preview ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          {/* Source tabs */}
          <div className="flex gap-1 bg-zinc-800 rounded-lg p-1 w-fit">
            {(["url", "paste"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSourceTab(t)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition capitalize ${
                  sourceTab === t ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t === "url" ? "From URL" : "Paste spec"}
              </button>
            ))}
          </div>

          {sourceTab === "url" ? (
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">OpenAPI / Swagger URL</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://petstore.swagger.io/v2/swagger.json"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Paste JSON or YAML spec</label>
              <textarea
                value={spec}
                onChange={(e) => setSpec(e.target.value)}
                rows={8}
                placeholder={"openapi: 3.0.0\ninfo:\n  title: My API\n..."}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
              />
            </div>
          )}

          {parseError && (
            <div className="flex items-center gap-2 text-red-400 text-xs">
              <AlertCircle size={13} />
              {parseError}
            </div>
          )}

          <button
            onClick={() => parseMutation.mutate()}
            disabled={parseMutation.isPending || (sourceTab === "url" ? !url : !spec)}
            className="flex items-center gap-2 bg-white text-zinc-900 font-medium rounded-lg px-4 py-2 text-sm hover:bg-zinc-200 transition disabled:opacity-50"
          >
            <Download size={14} />
            {parseMutation.isPending ? "Parsing…" : "Parse & preview"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-zinc-100">{preview.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{preview.endpoints.length} endpoints found</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setPreview(null); setSelected(new Set()); }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 rounded-lg px-3 py-1.5 transition"
                >
                  ← Back
                </button>
                <button
                  onClick={() => importMutation.mutate()}
                  disabled={selected.size === 0 || importMutation.isPending}
                  className="flex items-center gap-1.5 text-xs bg-white text-zinc-900 font-medium rounded-lg px-3 py-1.5 hover:bg-zinc-200 transition disabled:opacity-50"
                >
                  <Download size={12} />
                  {importMutation.isPending ? "Importing…" : `Import ${selected.size} flow${selected.size !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>

            <button
              onClick={toggleAll}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition mb-2"
            >
              {selected.size === preview.endpoints.length ? "Deselect all" : "Select all"}
            </button>

            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {preview.endpoints.map((ep, i) => (
                <label
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition ${
                    selected.has(i) ? "bg-zinc-800" : "hover:bg-zinc-800/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggleOne(i)}
                    className="rounded border-zinc-600 shrink-0"
                  />
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${METHOD_COLORS[ep.method] ?? "bg-zinc-700 text-zinc-400 border-zinc-600"}`}>
                    {ep.method}
                  </span>
                  <span className="font-mono text-xs text-zinc-400 flex-1 truncate">{ep.path}</span>
                  <span className="text-xs text-zinc-500 truncate max-w-[180px]">{ep.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const TABS: Array<{ id: ProjectTab; label: string; icon: React.ElementType }> = [
  { id: "flows",       label: "Flows",       icon: Code2             },
  { id: "credentials", label: "Credentials", icon: KeyRound          },
  { id: "environment", label: "Environment", icon: SlidersHorizontal },
  { id: "import",      label: "Import",      icon: Download          },
];

export function ProjectPage({ project, tab, onTabChange, onBack, onOpenBuilder }: Props) {
  const [connectOpen, setConnectOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 h-12 flex items-center gap-3 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-100 text-sm transition"
        >
          <ChevronLeft size={16} />
          Projects
        </button>
        <span className="text-zinc-700">/</span>
        <span className="text-sm font-semibold text-zinc-100">{project.name}</span>
        {project.description && (
          <span className="text-xs text-zinc-600 truncate max-w-xs">— {project.description}</span>
        )}
        <div className="ml-auto">
          <button
            onClick={() => setConnectOpen(true)}
            className="flex items-center gap-1.5 text-xs border border-zinc-700 text-zinc-400 rounded-lg px-3 py-1.5 hover:bg-zinc-800 hover:text-zinc-100 transition"
          >
            <Link2 size={12} />
            Connect to Claude
          </button>
        </div>
      </header>

      {connectOpen && (
        <ConnectModal project={project} onClose={() => setConnectOpen(false)} />
      )}

      {/* Tabs */}
      <div className="border-b border-zinc-800 px-6 shrink-0">
        <div className="flex gap-0">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
                tab === id
                  ? "border-white text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="px-8 py-8 max-w-3xl">
          {tab === "flows"       && <FlowsTab project={project} onOpenBuilder={onOpenBuilder} />}
          {tab === "credentials" && <CredentialsTab project={project} />}
          {tab === "environment" && <EnvironmentTab project={project} />}
          {tab === "import"      && <ImportTab project={project} />}
        </div>
      </main>
    </div>
  );
}
