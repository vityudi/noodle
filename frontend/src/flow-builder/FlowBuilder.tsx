import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { flowsApi, type Flow, type Project } from "@/lib/api";
import { FlowCanvas } from "./FlowCanvas";
import { NodePalette } from "./NodePalette";
import { CreateFlowDialog } from "./CreateFlowDialog";
import { TestPanel } from "./TestPanel";
import { CredentialsPanel } from "./CredentialsPanel";
import { ChevronLeft, Save, Plus, Check, Play, KeyRound } from "lucide-react";

interface Props {
  project: Project;
  onBack: () => void;
}

export function FlowBuilder({ project, onBack }: Props) {
  const queryClient = useQueryClient();
  const saveRef = useRef<() => Promise<void>>(async () => {});
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [credsOpen, setCredsOpen] = useState(false);

  const { data: flows = [] } = useQuery({
    queryKey: ["flows", project.id],
    queryFn: () => flowsApi.list(project.id),
  });

  useEffect(() => {
    if (flows.length > 0 && !selectedFlowId) {
      setSelectedFlowId(flows[0].id);
    }
  }, [flows, selectedFlowId]);

  const selectedFlow = flows.find((f) => f.id === selectedFlowId) ?? null;

  async function handleSave() {
    setSaving(true);
    try {
      await saveRef.current();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function handleFlowCreated(flow: Flow) {
    queryClient.invalidateQueries({ queryKey: ["flows", project.id] });
    setSelectedFlowId(flow.id);
  }

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Header */}
      <header className="border-b border-zinc-800 px-4 h-12 flex items-center gap-3 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-zinc-400 hover:text-zinc-100 text-sm transition shrink-0"
        >
          <ChevronLeft size={16} />
          <span className="hidden sm:inline">{project.name}</span>
        </button>

        <span className="text-zinc-700">/</span>

        {flows.length > 0 ? (
          <select
            value={selectedFlowId ?? ""}
            onChange={(e) => setSelectedFlowId(e.target.value)}
            className="bg-transparent text-sm text-zinc-100 focus:outline-none cursor-pointer max-w-[200px] truncate"
          >
            {flows.map((f) => (
              <option key={f.id} value={f.id} className="bg-zinc-900">
                {f.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-zinc-500">No flows</span>
        )}

        <div className="flex-1" />

        <button
          onClick={() => { setCredsOpen((v) => !v); setTestOpen(false); }}
          className={`flex items-center gap-1.5 text-xs border rounded-md px-2.5 py-1 transition shrink-0 ${
            credsOpen
              ? "bg-zinc-800 border-zinc-600 text-zinc-100"
              : "border-zinc-700 text-zinc-400 hover:text-zinc-100"
          }`}
        >
          <KeyRound size={12} />
          Credentials
        </button>

        {selectedFlow && (
          <button
            onClick={() => { setTestOpen((v) => !v); setCredsOpen(false); }}
            className={`flex items-center gap-1.5 text-xs border rounded-md px-2.5 py-1 transition shrink-0 ${
              testOpen
                ? "bg-zinc-800 border-zinc-600 text-zinc-100"
                : "border-zinc-700 text-zinc-400 hover:text-zinc-100"
            }`}
          >
            <Play size={12} />
            Test
          </button>
        )}

        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 border border-zinc-700 rounded-md px-2.5 py-1 transition shrink-0"
        >
          <Plus size={13} />
          New flow
        </button>

        <button
          onClick={handleSave}
          disabled={!selectedFlow || saving}
          className="flex items-center gap-2 bg-white text-zinc-900 font-medium rounded-lg px-3 py-1.5 text-sm hover:bg-zinc-200 transition disabled:opacity-50 shrink-0"
        >
          {saved ? <Check size={14} className="text-green-600" /> : <Save size={14} />}
          {saving ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <NodePalette />

        {selectedFlow ? (
          <FlowCanvas
            key={selectedFlow.id}
            flow={selectedFlow}
            projectId={project.id}
            saveRef={saveRef}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <p className="text-zinc-500 text-sm">No flows yet for this project.</p>
            <button
              onClick={() => setCreateOpen(true)}
              className="bg-white text-zinc-900 font-medium rounded-lg px-4 py-2 text-sm hover:bg-zinc-200 transition"
            >
              Create your first flow
            </button>
          </div>
        )}

        {credsOpen && (
          <CredentialsPanel project={project} onClose={() => setCredsOpen(false)} />
        )}

        {testOpen && selectedFlow && (
          <TestPanel
            project={project}
            flow={selectedFlow}
            onClose={() => setTestOpen(false)}
          />
        )}
      </div>

      <CreateFlowDialog
        projectId={project.id}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleFlowCreated}
      />
    </div>
  );
}
