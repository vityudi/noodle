import { FileCode2, ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const SCHEMA_URL = `${API_BASE}/schema/flow.json`;

const TEMPLATE_EXAMPLE = `{
  "schema_version": "1.0",
  "name": "find_customer",
  "description": "Finds a customer by email",
  "input_schema": {
    "email": { "type": "string", "required": true }
  },
  "nodes": [
    {
      "id": "fetch",
      "type": "http_request",
      "config": {
        "url": "{{env.API_URL}}/customers",
        "method": "GET",
        "params": { "email": "{{input.email}}" }
      },
      "outputs": { "body": { "type": "any" } }
    },
    {
      "id": "format",
      "type": "json_transform",
      "config": {
        "mapping": {
          "name": "{{nodes.fetch.outputs.body.data.name}}",
          "plan": "{{nodes.fetch.outputs.body.data.plan}}"
        }
      },
      "outputs": { "result": { "type": "object" } }
    }
  ],
  "edges": [{ "from": "fetch", "to": "format" }],
  "output": "{{nodes.format.outputs.result}}"
}`;

const NODE_TYPES = [
  { type: "http_request", desc: "GET/POST/PUT/DELETE to any REST API", fields: "url, method, headers, params, body" },
  { type: "json_transform", desc: "Remap and reshape JSON fields", fields: "mapping" },
  { type: "condition", desc: "Boolean comparison to branch flow", fields: "left, operator, right" },
  { type: "api_key", desc: "Inject API key as header", fields: "credential, header, prefix" },
  { type: "basic_auth", desc: "HTTP Basic Auth header", fields: "credential" },
  { type: "bearer_token", desc: "Bearer token header", fields: "credential" },
];

const TEMPLATE_REFS = [
  { expr: "{{input.field}}", desc: "Value from the tool's input parameters" },
  { expr: "{{nodes.id.outputs.field}}", desc: "Output of another node (dot-path)" },
  { expr: "{{env.VAR_NAME}}", desc: "Environment variable" },
  { expr: "{{credentials.name}}", desc: "Decrypted credential by name" },
];

export function SchemaPage() {
  const [copied, setCopied] = useState(false);

  function copySchema() {
    navigator.clipboard.writeText(SCHEMA_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Flow Schema Spec</h1>
        <p className="text-zinc-400 text-sm mt-1">
          The public JSON Schema that defines the Noodle flow format. Use it for validation, editor tooling, or to build your own integrations.
        </p>
      </div>

      {/* Schema URL */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <FileCode2 size={15} className="text-zinc-400" />
          <span className="text-sm font-medium text-zinc-200">Schema endpoint</span>
        </div>
        <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
          <code className="text-xs text-zinc-300 flex-1 font-mono">{SCHEMA_URL}</code>
          <button onClick={copySchema} className="text-zinc-500 hover:text-zinc-200 transition shrink-0">
            {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
          </button>
          <a href={SCHEMA_URL} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-zinc-200 transition shrink-0">
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* Template expressions */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-medium text-zinc-200 mb-3">Template expressions</h2>
        <p className="text-xs text-zinc-500 mb-4">Use these in any node config value to reference dynamic data.</p>
        <div className="space-y-2">
          {TEMPLATE_REFS.map((r) => (
            <div key={r.expr} className="flex items-start gap-4">
              <code className="text-xs font-mono text-zinc-300 bg-zinc-800 px-2 py-1 rounded shrink-0">{r.expr}</code>
              <span className="text-xs text-zinc-500 pt-1">{r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Built-in node types */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-medium text-zinc-200 mb-3">Built-in node types</h2>
        <div className="divide-y divide-zinc-800">
          {NODE_TYPES.map((n) => (
            <div key={n.type} className="py-3 flex items-start gap-4">
              <code className="text-xs font-mono text-zinc-300 bg-zinc-800 px-2 py-1 rounded shrink-0 mt-0.5">{n.type}</code>
              <div>
                <p className="text-xs text-zinc-300">{n.desc}</p>
                <p className="text-xs text-zinc-600 mt-0.5">config: {n.fields}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Example */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="text-sm font-medium text-zinc-200 mb-3">Example flow</h2>
        <pre className="text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre bg-zinc-800 rounded-lg p-4 leading-relaxed">
          {TEMPLATE_EXAMPLE}
        </pre>
      </div>
    </div>
  );
}
