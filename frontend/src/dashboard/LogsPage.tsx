import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { logsApi, projectsApi, type ExecutionLog, type Project } from "@/lib/api";
import { CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function duration(ms: number | null) {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

function LogRow({ log }: { log: ExecutionLog }) {
  const [open, setOpen] = useState(false);
  const ok = !log.error;

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-900 hover:bg-zinc-800/60 transition text-left"
      >
        {ok ? (
          <CheckCircle2 size={15} className="text-green-500 shrink-0" />
        ) : (
          <XCircle size={15} className="text-red-500 shrink-0" />
        )}
        <span className="text-sm text-zinc-300 font-medium flex-1 truncate">{log.flow_name}</span>
        <span className="text-xs text-zinc-500 flex items-center gap-1 shrink-0">
          <Clock size={11} />
          {duration(log.duration_ms)}
        </span>
        <span className="text-xs text-zinc-600 shrink-0 w-20 text-right">{relativeTime(log.executed_at)}</span>
        {open ? <ChevronDown size={14} className="text-zinc-500 shrink-0" /> : <ChevronRight size={14} className="text-zinc-500 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-zinc-800 bg-zinc-950 p-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-zinc-500 font-medium mb-2">Input</p>
            <pre className="text-xs font-mono text-zinc-300 bg-zinc-900 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap">
              {JSON.stringify(log.input, null, 2) ?? "—"}
            </pre>
          </div>
          <div>
            <p className="text-xs text-zinc-500 font-medium mb-2">
              {log.error ? "Error" : "Output"}
            </p>
            {log.error ? (
              <div className="text-xs font-mono text-red-300 bg-red-950/30 border border-red-900 rounded-lg p-3 max-h-48 overflow-auto">
                {log.error}
              </div>
            ) : (
              <pre className="text-xs font-mono text-zinc-300 bg-zinc-900 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap">
                {JSON.stringify(log.output, null, 2) ?? "—"}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function LogsPage() {
  const [projectId, setProjectId] = useState<string>("");

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
  });

  const selectedProject: Project | undefined =
    projects.find((p) => p.id === projectId) ?? projects[0];

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["logs", selectedProject?.id],
    queryFn: () => logsApi.list(selectedProject!.id),
    enabled: !!selectedProject,
  });

  return (
    <div>
      {projects.length > 1 && (
        <div className="flex justify-end mb-6">
          <Select value={selectedProject?.id ?? ""} onValueChange={setProjectId}>
            <SelectTrigger className="w-48 bg-zinc-800 border-zinc-700 text-zinc-100 text-sm h-9 focus:ring-zinc-600 focus:ring-offset-zinc-950">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700 text-zinc-100">
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100">
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!selectedProject ? (
        <div className="border border-dashed border-zinc-800 rounded-xl p-16 text-center">
          <p className="text-zinc-400 text-sm">No projects yet.</p>
        </div>
      ) : isLoading ? (
        <div className="text-zinc-500 text-sm">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded-xl p-16 text-center">
          <p className="text-zinc-400 text-sm">No executions yet for {selectedProject.name}.</p>
          <p className="text-zinc-600 text-xs mt-1">Run a flow from the Test panel to see logs here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <LogRow key={log.id} log={log} />
          ))}
        </div>
      )}
    </div>
  );
}
