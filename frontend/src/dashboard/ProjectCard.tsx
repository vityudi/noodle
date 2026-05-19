import { type Project } from "@/lib/api";
import { Globe, Trash2, ArrowRight } from "lucide-react";

interface Props {
  project: Project;
  onDelete: (id: string) => void;
  onOpen: (project: Project) => void;
}

export function ProjectCard({ project, onDelete, onOpen }: Props) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition group flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-zinc-100 truncate">{project.name}</h3>
          <div className="flex items-center gap-1 mt-1">
            <Globe size={11} className="text-zinc-500 shrink-0" />
            <span className="text-xs text-zinc-500 truncate">/mcp/{project.slug}</span>
          </div>
        </div>
        <button
          onClick={() => onDelete(project.id)}
          className="text-zinc-600 hover:text-red-400 transition opacity-0 group-hover:opacity-100 shrink-0"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {project.description && (
        <p className="text-sm text-zinc-400 mt-3 line-clamp-2 flex-1">{project.description}</p>
      )}

      <button
        onClick={() => onOpen(project)}
        className="mt-4 w-full flex items-center justify-center gap-2 border border-zinc-700 text-zinc-300 text-sm rounded-lg py-2 hover:bg-zinc-800 hover:text-zinc-100 transition"
      >
        Open flow builder
        <ArrowRight size={14} />
      </button>
    </div>
  );
}
