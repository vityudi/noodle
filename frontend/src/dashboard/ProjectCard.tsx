import { useState } from "react";
import { type Project } from "@/lib/api";
import { Globe, Trash2, ArrowRight, Copy, Check } from "lucide-react";

interface Props {
  project: Project;
  onDelete: (id: string) => void;
  onOpen: (project: Project) => void;
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export function ProjectCard({ project, onDelete, onOpen }: Props) {
  const [copied, setCopied] = useState(false);
  const mcpUrl = `${API_BASE}/mcp/${project.slug}`;

  function copyUrl() {
    navigator.clipboard.writeText(mcpUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition group flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-zinc-100 truncate">{project.name}</h3>
          {project.description && (
            <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{project.description}</p>
          )}
        </div>
        <button
          onClick={() => onDelete(project.id)}
          className="text-zinc-600 hover:text-red-400 transition opacity-0 group-hover:opacity-100 shrink-0"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* MCP endpoint */}
      <div className="mt-4 flex items-center gap-1.5 bg-zinc-800 rounded-lg px-3 py-2">
        <Globe size={12} className="text-zinc-500 shrink-0" />
        <span className="text-xs text-zinc-400 truncate flex-1 font-mono">/mcp/{project.slug}</span>
        <button
          onClick={copyUrl}
          className="text-zinc-500 hover:text-zinc-200 transition shrink-0"
          title="Copy MCP endpoint"
        >
          {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
        </button>
      </div>

      <button
        onClick={() => onOpen(project)}
        className="mt-3 w-full flex items-center justify-center gap-2 border border-zinc-700 text-zinc-300 text-sm rounded-lg py-2 hover:bg-zinc-800 hover:text-zinc-100 transition"
      >
        Open flow builder
        <ArrowRight size={14} />
      </button>
    </div>
  );
}
