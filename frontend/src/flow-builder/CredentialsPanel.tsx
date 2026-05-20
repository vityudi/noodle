import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { credentialsApi, type Credential, type Project } from "@/lib/api";
import { X, Plus, Trash2, Eye, EyeOff, Key, Lock, Database, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CREDENTIAL_TYPES = [
  { value: "api_key",      label: "API Key",           fields: [{ key: "key",           label: "Key",           secret: true  }] },
  { value: "bearer_token", label: "Bearer Token",      fields: [{ key: "token",         label: "Token",         secret: true  }] },
  { value: "basic_auth",   label: "Basic Auth",        fields: [{ key: "username",      label: "Username",      secret: false },
                                                                 { key: "password",      label: "Password",      secret: true  }] },
  { value: "oauth2",       label: "OAuth 2.0",         fields: [{ key: "client_id",     label: "Client ID",     secret: false },
                                                                 { key: "client_secret", label: "Client Secret", secret: true  },
                                                                 { key: "token_url",     label: "Token URL",     secret: false }] },
  { value: "db_url",       label: "Database URL",      fields: [{ key: "url",           label: "Connection URL", secret: true }] },
];

interface Props {
  project: Project;
  onClose: () => void;
}

function SchemaBlock({ schema }: { schema: string }) {
  const lines = schema.trim().split("\n");
  return (
    <div className="mt-2 bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-2.5 space-y-0.5">
      <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide mb-1.5">Schema</p>
      {lines.map((line, i) => {
        const [table, rest] = line.split("(");
        return (
          <div key={i} className="text-[11px] font-mono">
            <span className="text-indigo-400">{table}</span>
            {rest && <span className="text-zinc-500">(</span>}
            {rest && <span className="text-zinc-400">{rest.replace(")", "")}</span>}
            {rest && <span className="text-zinc-500">)</span>}
          </div>
        );
      })}
    </div>
  );
}

function IntrospectButton({ projectId, credId, onDone, label = "Detect schema" }: { projectId: string; credId: string; onDone: () => void; label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handle() {
    setLoading(true);
    setError("");
    try {
      const res = await credentialsApi.introspect(projectId, credId);
      if (res.ok) {
        onDone();
      } else {
        setError(res.error ?? "Failed");
      }
    } catch {
      setError("Connection failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-1.5">
      <button
        onClick={handle}
        disabled={loading}
        className="flex items-center gap-1 text-xs text-zinc-600 hover:text-indigo-400 transition disabled:opacity-50"
      >
        <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
        {loading ? "Detecting…" : label}
      </button>
      {error && <p className="text-[11px] text-red-400 mt-0.5">{error}</p>}
    </div>
  );
}

function RevealButton({ projectId, cred }: { projectId: string; cred: Credential }) {
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
    <div className="mt-1.5">
      <button
        onClick={toggle}
        disabled={loading}
        className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition"
      >
        {data ? <EyeOff size={11} /> : <Eye size={11} />}
        {data ? "Hide" : "Reveal"}
      </button>
      {data && (
        <div className="mt-1.5 bg-zinc-800 rounded-lg p-2 space-y-0.5">
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

function AddForm({ projectId, onDone }: { projectId: string; onDone: () => void }) {
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
    onError: () => setError("Name already exists."),
  });

  return (
    <div className="border border-zinc-700 rounded-lg p-3 space-y-3 bg-zinc-900">
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my-api-key"
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
        />
      </div>
      <div>
        <label className="block text-xs text-zinc-400 mb-1">Type</label>
        <Select value={type} onValueChange={(v) => { setType(v); setFields({}); }}>
          <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-100 text-xs h-8 focus:ring-zinc-600 focus:ring-offset-zinc-900">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-800 border-zinc-700 text-zinc-100">
            {CREDENTIAL_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {typeDef.fields.map((f) => (
        <div key={f.key}>
          <label className="block text-xs text-zinc-400 mb-1">{f.label}</label>
          <input
            type={f.secret ? "password" : "text"}
            value={fields[f.key] ?? ""}
            onChange={(e) => setFields((p) => ({ ...p, [f.key]: e.target.value }))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-500"
          />
        </div>
      ))}
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onDone} className="flex-1 text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded py-1.5 transition">
          Cancel
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={!name || mutation.isPending}
          className="flex-1 text-xs bg-white text-zinc-900 font-medium rounded py-1.5 hover:bg-zinc-200 transition disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

export function CredentialsPanel({ project, onClose }: Props) {
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
    <div className="w-72 border-l border-zinc-800 bg-zinc-950 flex flex-col shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <div>
          <p className="text-sm font-medium text-zinc-100">Credentials</p>
          <p className="text-xs text-zinc-500 font-mono">{"{{credentials.name}}"}</p>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <p className="text-xs text-zinc-500">Loading…</p>
        ) : creds.length === 0 && !adding ? (
          <div className="text-center py-6">
            <Lock size={20} className="text-zinc-700 mx-auto mb-2" />
            <p className="text-xs text-zinc-500">No credentials yet.</p>
          </div>
        ) : (
          creds.map((c) => (
            <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {c.connection_type
                    ? <Database size={12} className="text-indigo-400 shrink-0" />
                    : c.type === "api_key" || c.type === "bearer_token"
                      ? <Key size={12} className="text-zinc-500 shrink-0" />
                      : <Lock size={12} className="text-zinc-500 shrink-0" />}
                  <span className="text-xs font-medium text-zinc-200 truncate">{c.name}</span>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(c.id)}
                  className="text-zinc-600 hover:text-red-400 transition shrink-0 ml-2"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {c.schema_cache ? (
                <>
                  <SchemaBlock schema={c.schema_cache} />
                  <IntrospectButton
                    label="Refresh schema"
                    projectId={project.id}
                    credId={c.id}
                    onDone={() => qc.invalidateQueries({ queryKey: ["credentials", project.id] })}
                  />
                </>
              ) : c.connection_type ? (
                <IntrospectButton
                  projectId={project.id}
                  credId={c.id}
                  onDone={() => qc.invalidateQueries({ queryKey: ["credentials", project.id] })}
                />
              ) : (
                <RevealButton projectId={project.id} cred={c} />
              )}
            </div>
          ))
        )}

        {adding && (
          <AddForm projectId={project.id} onDone={() => setAdding(false)} />
        )}
      </div>

      {!adding && (
        <div className="px-3 py-3 border-t border-zinc-800 shrink-0">
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center justify-center gap-2 border border-zinc-700 text-zinc-400 text-xs rounded-lg py-2 hover:bg-zinc-800 hover:text-zinc-200 transition"
          >
            <Plus size={13} />
            Add credential
          </button>
        </div>
      )}
    </div>
  );
}
