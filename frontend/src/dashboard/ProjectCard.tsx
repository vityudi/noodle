import { useState } from "react";
import { type Project } from "@/lib/api";
import { Globe, Trash2, ArrowRight, Copy, Check, X, AlertTriangle } from "lucide-react";

interface Props {
  project: Project;
  onDelete: (id: string) => void;
  onOpen: (project: Project) => void;
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

function DeleteConfirmDialog({
  projectName,
  onConfirm,
  onCancel,
}: {
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-red-400" />
            </div>
            <h2 className="text-sm font-semibold text-zinc-100">Delete project</h2>
          </div>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300 transition">
            <X size={16} />
          </button>
        </div>

        <p className="text-sm text-zinc-400 mb-1">
          Are you sure you want to delete{" "}
          <span className="text-zinc-100 font-medium">"{projectName}"</span>?
        </p>
        <p className="text-xs text-zinc-500 mb-6">
          All flows, credentials, and execution logs will be permanently removed.
        </p>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:text-zinc-200 hover:border-zinc-600 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProjectCard({ project, onDelete, onOpen }: Props) {
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const sseUrl = `${API_BASE}/mcp/${project.slug}/sse`;

  function copyUrl() {
    navigator.clipboard.writeText(sseUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition group flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-zinc-100 truncate">{project.name}</h3>
          {project.description && (
            <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{project.description}</p>
          )}
        </div>
        <button
          onClick={() => setConfirmOpen(true)}
          className="text-zinc-600 hover:text-red-400 transition opacity-0 group-hover:opacity-100 shrink-0"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* MCP SSE endpoint */}
      <div className="mt-4 space-y-1.5">
        <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-wider">MCP endpoint</p>
        <div className="flex items-center gap-1.5 bg-zinc-800 rounded-lg px-3 py-2">
          <Globe size={12} className="text-zinc-500 shrink-0" />
          <span className="text-xs text-zinc-400 truncate flex-1 font-mono">/mcp/{project.slug}/sse</span>
          <button
            onClick={copyUrl}
            className="text-zinc-500 hover:text-zinc-200 transition shrink-0"
            title="Copy SSE endpoint"
          >
            {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      <button
        onClick={() => onOpen(project)}
        className="mt-3 w-full flex items-center justify-center gap-2 border border-zinc-700 text-zinc-300 text-sm rounded-lg py-2 hover:bg-zinc-800 hover:text-zinc-100 transition"
      >
        Open flow builder
        <ArrowRight size={14} />
      </button>
    </div>

    {confirmOpen && (
      <DeleteConfirmDialog
        projectName={project.name}
        onConfirm={() => { setConfirmOpen(false); onDelete(project.id); }}
        onCancel={() => setConfirmOpen(false)}
      />
    )}
    </>
  );
}
