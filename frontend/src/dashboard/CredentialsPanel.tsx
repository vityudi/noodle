import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { credentialsApi, type Credential } from "@/lib/api";
import { Plus, Trash2, Eye, EyeOff, Key, Lock } from "lucide-react";

const CREDENTIAL_TYPES = [
  { value: "api_key", label: "API Key", fields: [{ key: "key", label: "API Key", secret: true }] },
  {
    value: "basic_auth",
    label: "Basic Auth",
    fields: [
      { key: "username", label: "Username", secret: false },
      { key: "password", label: "Password", secret: true },
    ],
  },
  {
    value: "oauth2",
    label: "OAuth 2.0",
    fields: [
      { key: "client_id", label: "Client ID", secret: false },
      { key: "client_secret", label: "Client Secret", secret: true },
      { key: "token_url", label: "Token URL", secret: false },
    ],
  },
  {
    value: "bearer_token",
    label: "Bearer Token",
    fields: [{ key: "token", label: "Token", secret: true }],
  },
];

function typeIcon(type: string) {
  return type === "api_key" || type === "bearer_token" ? (
    <Key size={14} className="text-zinc-400" />
  ) : (
    <Lock size={14} className="text-zinc-400" />
  );
}

function typeLabel(type: string) {
  return CREDENTIAL_TYPES.find((t) => t.value === type)?.label ?? type;
}

interface AddDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

function AddCredentialDialog({ onClose, onCreated }: AddDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState("api_key");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => credentialsApi.create({ name, type, data: fields }),
    onSuccess: () => {
      onCreated();
      onClose();
    },
    onError: () => setError("Could not save credential. Name may already exist."),
  });

  const typeDef = CREDENTIAL_TYPES.find((t) => t.value === type)!;

  function handleTypeChange(t: string) {
    setType(t);
    setFields({});
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Add credential</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-api-key"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
            >
              {CREDENTIAL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {typeDef.fields.map((f) => (
            <div key={f.key}>
              <label className="block text-sm text-zinc-400 mb-1">{f.label}</label>
              <input
                type={f.secret ? "password" : "text"}
                value={fields[f.key] ?? ""}
                onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              />
            </div>
          ))}

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!name || mutation.isPending}
            className="px-4 py-2 text-sm bg-white text-zinc-900 font-medium rounded-lg hover:bg-zinc-200 transition disabled:opacity-50"
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface RevealButtonProps {
  credential: Credential;
}

function RevealButton({ credential }: RevealButtonProps) {
  const [revealed, setRevealed] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (revealed) {
      setRevealed(null);
      return;
    }
    setLoading(true);
    try {
      const res = await credentialsApi.reveal(credential.id);
      setRevealed(res.data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={toggle}
        disabled={loading}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition"
      >
        {revealed ? <EyeOff size={12} /> : <Eye size={12} />}
        {revealed ? "Hide" : "Reveal"}
      </button>
      {revealed && (
        <div className="mt-2 bg-zinc-800 rounded-lg p-3 space-y-1">
          {Object.entries(revealed).map(([k, v]) => (
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

export function CredentialsPanel() {
  const [addOpen, setAddOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: creds = [], isLoading } = useQuery({
    queryKey: ["credentials"],
    queryFn: credentialsApi.list,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => credentialsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["credentials"] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">Credentials</h2>
          <p className="text-zinc-400 text-sm mt-1">
            Stored encrypted — reference them in flows as{" "}
            <code className="text-zinc-300 bg-zinc-800 px-1 rounded">{"{{credentials.name}}"}</code>
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 bg-white text-zinc-900 font-medium rounded-lg px-4 py-2 text-sm hover:bg-zinc-200 transition"
        >
          <Plus size={16} />
          Add credential
        </button>
      </div>

      {isLoading ? (
        <div className="text-zinc-500 text-sm">Loading…</div>
      ) : creds.length === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded-xl p-12 text-center">
          <Lock size={28} className="text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">No credentials yet.</p>
          <button
            onClick={() => setAddOpen(true)}
            className="mt-4 bg-white text-zinc-900 font-medium rounded-lg px-4 py-2 text-sm hover:bg-zinc-200 transition"
          >
            Add first credential
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {creds.map((c) => (
            <div
              key={c.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {typeIcon(c.type)}
                  <span className="font-medium text-sm text-zinc-100">{c.name}</span>
                  <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                    {typeLabel(c.type)}
                  </span>
                </div>
                <button
                  onClick={() => deleteMutation.mutate(c.id)}
                  className="text-zinc-600 hover:text-red-400 transition"
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <RevealButton credential={c} />
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <AddCredentialDialog
          onClose={() => setAddOpen(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ["credentials"] })}
        />
      )}
    </div>
  );
}
