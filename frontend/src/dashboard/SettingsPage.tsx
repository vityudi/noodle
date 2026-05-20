import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { settingsApi } from "@/lib/api";
import { Check } from "lucide-react";

const PROVIDERS = [
  { value: "anthropic", label: "Anthropic", models: ["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5-20251001"] },
  { value: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  { value: "ollama", label: "Ollama (local)", models: ["llama3", "mistral", "phi3"] },
];

export function SettingsPage() {
  const { data: current } = useQuery({
    queryKey: ["settings", "ai"],
    queryFn: settingsApi.getAI,
  });

  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);

  const effectiveProvider = provider || current?.provider || "anthropic";
  const effectiveModel = model || current?.model || "";
  const providerDef = PROVIDERS.find((p) => p.value === effectiveProvider);

  const mutation = useMutation({
    mutationFn: () =>
      settingsApi.updateAI({
        provider: effectiveProvider,
        model: effectiveModel,
        ...(apiKey ? { api_key: apiKey } : {}),
      }),
    onSuccess: () => {
      setSaved(true);
      setApiKey("");
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <div className="max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-zinc-400 text-sm mt-1">Configure the AI assistant and other instance settings.</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-zinc-200 mb-5">AI Assistant</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Provider</label>
            <select
              value={effectiveProvider}
              onChange={(e) => { setProvider(e.target.value); setModel(""); }}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 font-medium">Model</label>
            <select
              value={effectiveModel}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
            >
              {providerDef?.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {current?.model && (
              <p className="text-xs text-zinc-600 mt-1">Current: {current.model}</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
              API Key{" "}
              <span className="text-zinc-600 font-normal">
                {current?.provider ? "(leave blank to keep existing)" : ""}
              </span>
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={current?.provider ? "••••••••" : "Enter API key"}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>
        </div>

        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="mt-6 flex items-center gap-2 bg-white text-zinc-900 font-medium rounded-lg px-4 py-2 text-sm hover:bg-zinc-200 transition disabled:opacity-50"
        >
          {saved && <Check size={14} className="text-green-600" />}
          {mutation.isPending ? "Saving…" : saved ? "Saved" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
