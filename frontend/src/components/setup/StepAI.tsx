import { useState } from "react";
import { setupApi } from "@/lib/api";

const PROVIDERS = [
  { id: "anthropic", label: "Anthropic", placeholder: "sk-ant-…", models: ["claude-sonnet-4-6", "claude-opus-4-7", "claude-haiku-4-5-20251001"] },
  { id: "openai", label: "OpenAI", placeholder: "sk-…", models: ["gpt-4o", "gpt-4o-mini", "o3"] },
  { id: "ollama", label: "Ollama (local)", placeholder: "http://host.docker.internal:11434", models: ["llama3", "mistral", "phi3"] },
];

interface Props {
  onDone: () => void;
}

export function StepAI({ onDone }: Props) {
  const [provider, setProvider] = useState("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const current = PROVIDERS.find((p) => p.id === provider)!;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await setupApi.configureAI(provider, apiKey, model || current.models[0]);
      onDone();
    } catch {
      setError("Could not save configuration. Check your key and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    await setupApi.skipAI();
    onDone();
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-100 mb-1">AI Assistant</h2>
      <p className="text-zinc-400 text-sm mb-6">
        Optional — Noodle works fully without AI. You can configure this later in Settings.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-300 mb-2">Provider</label>
          <div className="flex gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setProvider(p.id); setApiKey(""); setModel(""); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                  provider === p.id
                    ? "bg-zinc-700 border-zinc-500 text-zinc-100"
                    : "bg-transparent border-zinc-700 text-zinc-400 hover:border-zinc-600"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-zinc-300 mb-1">
            {provider === "ollama" ? "Base URL" : "API Key"}
          </label>
          <input
            type={provider === "ollama" ? "url" : "password"}
            required
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={current.placeholder}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-300 mb-1">Model</label>
          <select
            value={model || current.models[0]}
            onChange={(e) => setModel(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm focus:outline-none focus:border-zinc-500"
          >
            {current.models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-white text-zinc-900 font-medium rounded-lg py-2 text-sm hover:bg-zinc-200 transition disabled:opacity-50"
        >
          {loading ? "Saving…" : "Save & Continue"}
        </button>
      </form>

      <button
        onClick={handleSkip}
        className="w-full mt-3 text-zinc-500 text-sm hover:text-zinc-300 transition"
      >
        Skip for now
      </button>
    </div>
  );
}
