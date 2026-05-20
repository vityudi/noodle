import { useState } from "react";
import { X, Copy, Check, Monitor, Terminal, Globe } from "lucide-react";
import { type Project } from "@/lib/api";

interface Props {
  project: Project;
  onClose: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

type Tab = "claude-desktop" | "claude-code" | "generic";

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative group">
      <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-xs text-zinc-300 font-mono overflow-x-auto whitespace-pre">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2.5 right-2.5 p-1.5 rounded-md bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition opacity-0 group-hover:opacity-100"
      >
        {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
      </button>
    </div>
  );
}

export function ConnectModal({ project, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("claude-desktop");
  const sseUrl = `${API_BASE}/mcp/${project.slug}/sse`;

  const desktopSnippet = JSON.stringify(
    {
      mcpServers: {
        [project.slug]: {
          type: "sse",
          url: sseUrl,
        },
      },
    },
    null,
    2
  );

  const codeSnippet = JSON.stringify(
    {
      mcpServers: {
        [project.slug]: {
          type: "sse",
          url: sseUrl,
        },
      },
    },
    null,
    2
  );

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "claude-desktop", label: "Claude Desktop", icon: <Monitor size={13} /> },
    { id: "claude-code", label: "Claude Code", icon: <Terminal size={13} /> },
    { id: "generic", label: "Other clients", icon: <Globe size={13} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Connect to an AI agent</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Add <span className="text-zinc-300 font-medium">{project.name}</span> as an MCP server
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition">
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                tab === t.id
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-3">
          {tab === "claude-desktop" && (
            <>
              <p className="text-xs text-zinc-400">
                Open <span className="text-zinc-200 font-mono">claude_desktop_config.json</span> and
                merge the snippet below. On macOS the file is at{" "}
                <span className="text-zinc-200 font-mono">~/Library/Application Support/Claude/</span>,
                on Windows at{" "}
                <span className="text-zinc-200 font-mono">%APPDATA%\Claude\</span>.
              </p>
              <CodeBlock code={desktopSnippet} />
              <p className="text-xs text-zinc-500">Restart Claude Desktop after saving the file.</p>
            </>
          )}

          {tab === "claude-code" && (
            <>
              <p className="text-xs text-zinc-400">
                Add the snippet below to{" "}
                <span className="text-zinc-200 font-mono">.claude/settings.json</span> in your project
                root, or to the global settings at{" "}
                <span className="text-zinc-200 font-mono">~/.claude/settings.json</span>.
              </p>
              <CodeBlock code={codeSnippet} />
              <p className="text-xs text-zinc-500">
                The MCP server will be available in your next Claude Code session.
              </p>
            </>
          )}

          {tab === "generic" && (
            <>
              <p className="text-xs text-zinc-400">
                Any MCP-compatible client can connect via SSE. Use the endpoint URL below.
              </p>
              <CodeBlock code={sseUrl} />
              <div className="space-y-1.5">
                <p className="text-xs text-zinc-500 font-medium">Quick test with curl:</p>
                <CodeBlock
                  code={`# 1. Open SSE stream (copy the sessionId from the endpoint event)\ncurl -N "${sseUrl}"\n\n# 2. List tools (replace SESSION_ID)\ncurl -X POST "${API_BASE}/mcp/${project.slug}/message?sessionId=SESSION_ID" \\\n  -H "Content-Type: application/json" \\\n  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
