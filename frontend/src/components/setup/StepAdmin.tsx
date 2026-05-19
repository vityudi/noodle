import { useState } from "react";
import { setupApi } from "@/lib/api";

interface Props {
  onDone: (token: string) => void;
}

export function StepAdmin({ onDone }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token } = await setupApi.createAdmin(email, password);
      localStorage.setItem("token", token);
      onDone(token);
    } catch {
      setError("Could not create account. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-100 mb-1">Create your account</h2>
      <p className="text-zinc-400 text-sm mb-6">This will be the admin account for your Noodle instance.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-300 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-300 mb-1">Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
            placeholder="min. 8 characters"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-white text-zinc-900 font-medium rounded-lg py-2 text-sm hover:bg-zinc-200 transition disabled:opacity-50"
        >
          {loading ? "Creating…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
