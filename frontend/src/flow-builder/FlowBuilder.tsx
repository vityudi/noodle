import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { flowsApi, type Flow, type Project } from "@/lib/api";
import { FlowCanvas } from "./FlowCanvas";
import { NodePalette } from "./NodePalette";
import { CreateFlowDialog } from "./CreateFlowDialog";
import { TestPanel } from "./TestPanel";
import { CredentialsPanel } from "./CredentialsPanel";
import { FlowSettingsPanel } from "./FlowSettingsPanel";
import { OpenAPIImportModal } from "./OpenAPIImportModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, Save, Plus, Check, Play, KeyRound, ChevronDown, Trash2, AlertTriangle, Settings2, FileJson } from "lucide-react";

interface Props {
  project: Project;
  onBack: () => void;
}

export function FlowBuilder({ project, onBack }: Props) {
  const queryClient = useQueryClient();
  const saveRef = useRef<() => Promise<void>>(async () => {});
  const loadRef = useRef<(schema: object) => void>(() => {});
  const schemaRef = useRef<() => object>(() => ({}));
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [credsOpen, setCredsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [nameError, setNameError] = useState(false);

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
  const isDraft = flows.length === 0;

  const draftFlow: Flow = {
    id: "__draft__",
    project_id: project.id,
    name: draftName,
    description: "",
    flow_json: {},
    created_at: "",
    updated_at: "",
  };

  const activeFlow = isDraft ? draftFlow : selectedFlow;

  async function handleSave() {
    if (isDraft) {
      const name = draftName.trim();
      if (!name) {
        setNameError(true);
        nameInputRef.current?.focus();
        return;
      }
      setSaving(true);
      try {
        const schema = schemaRef.current();
        const newFlow = await flowsApi.create(project.id, { name, flow_json: schema });
        await queryClient.invalidateQueries({ queryKey: ["flows", project.id] });
        setSelectedFlowId(newFlow.id);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } finally {
        setSaving(false);
      }
      return;
    }
    setSaving(true);
    try {
      await saveRef.current();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const deleteMutation = useMutation({
    mutationFn: () => flowsApi.delete(project.id, selectedFlowId!),
    onSuccess: () => {
      const next = flows.find((f) => f.id !== selectedFlowId);
      setSelectedFlowId(next?.id ?? null);
      queryClient.invalidateQueries({ queryKey: ["flows", project.id] });
      setDeleteOpen(false);
    },
  });

  function handleFlowCreated(flow: Flow) {
    queryClient.invalidateQueries({ queryKey: ["flows", project.id] });
    setSelectedFlowId(flow.id);
  }

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
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

        {isDraft ? (
          <div className="flex items-center gap-1">
            <input
              ref={nameInputRef}
              value={draftName}
              onChange={(e) => { setDraftName(e.target.value); setNameError(false); }}
              placeholder="Flow name..."
              className={`bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none px-2 py-1 rounded-md border transition max-w-[200px] ${
                nameError
                  ? "border-red-500 placeholder:text-red-500/60"
                  : "border-transparent focus:border-zinc-700"
              }`}
            />
            <button
              onClick={() => setCreateOpen(true)}
              className="p-1 text-zinc-600 hover:text-zinc-100 rounded-md hover:bg-zinc-800 transition"
              title="New flow"
            >
              <Plus size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 text-sm text-zinc-100 hover:text-white px-2 py-1 rounded-md hover:bg-zinc-800 transition max-w-[200px]">
                  <span className="truncate">{selectedFlow?.name ?? "Select flow"}</span>
                  <ChevronDown size={13} className="text-zinc-400 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[180px] bg-zinc-900 border-zinc-800 text-zinc-100">
                {flows.map((f) => (
                  <DropdownMenuItem
                    key={f.id}
                    onSelect={() => setSelectedFlowId(f.id)}
                    className={`text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer ${f.id === selectedFlowId ? "bg-zinc-800 text-zinc-100" : ""}`}
                  >
                    {f.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem onSelect={() => setCreateOpen(true)} className="text-zinc-400 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer">
                  <Plus size={13} />
                  New flow
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {selectedFlow && (
              <button
                onClick={() => setDeleteOpen(true)}
                className="p-1 text-zinc-600 hover:text-red-400 rounded-md hover:bg-zinc-800 transition"
                title="Delete flow"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}

        <div className="flex-1" />

        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-1.5 text-xs border border-zinc-700 text-zinc-400 hover:text-zinc-100 rounded-md px-2.5 py-1 transition shrink-0"
          title="Import flows from OpenAPI / Swagger spec"
        >
          <FileJson size={12} />
          Import
        </button>

        <button
          onClick={() => { setCredsOpen((v) => !v); setTestOpen(false); setSettingsOpen(false); }}
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
          <>
            <button
              onClick={() => { setSettingsOpen((v) => !v); setTestOpen(false); setCredsOpen(false); }}
              className={`flex items-center gap-1.5 text-xs border rounded-md px-2.5 py-1 transition shrink-0 ${
                settingsOpen
                  ? "bg-zinc-800 border-zinc-600 text-zinc-100"
                  : "border-zinc-700 text-zinc-400 hover:text-zinc-100"
              }`}
            >
              <Settings2 size={12} />
              Settings
            </button>
            <button
              onClick={() => { setTestOpen((v) => !v); setCredsOpen(false); setSettingsOpen(false); }}
              className={`flex items-center gap-1.5 text-xs border rounded-md px-2.5 py-1 transition shrink-0 ${
                testOpen
                  ? "bg-zinc-800 border-zinc-600 text-zinc-100"
                  : "border-zinc-700 text-zinc-400 hover:text-zinc-100"
              }`}
            >
              <Play size={12} />
              Test
            </button>
          </>
        )}

        <button
          onClick={handleSave}
          disabled={(!activeFlow || saving)}
          className="flex items-center gap-2 bg-white text-zinc-900 font-medium rounded-lg px-3 py-1.5 text-sm hover:bg-zinc-200 transition disabled:opacity-50 shrink-0"
        >
          {saved ? <Check size={14} className="text-green-600" /> : <Save size={14} />}
          {saving ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <NodePalette />

        {activeFlow && (
          <FlowCanvas
            key={activeFlow.id}
            flow={activeFlow}
            projectId={project.id}
            saveRef={saveRef}
            loadRef={loadRef}
            schemaRef={isDraft ? schemaRef : undefined}
          />
        )}

        {credsOpen && (
          <CredentialsPanel project={project} onClose={() => setCredsOpen(false)} />
        )}

        {settingsOpen && selectedFlow && (
          <FlowSettingsPanel
            project={project}
            flow={selectedFlow}
            onClose={() => setSettingsOpen(false)}
          />
        )}

        {testOpen && selectedFlow && (
          <TestPanel
            project={project}
            flow={selectedFlow}
            onClose={() => setTestOpen(false)}
          />
        )}
      </div>

      {importOpen && (
        <OpenAPIImportModal
          project={project}
          onClose={() => setImportOpen(false)}
          onImported={() => setImportOpen(false)}
        />
      )}

      <CreateFlowDialog
        projectId={project.id}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleFlowCreated}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[400px] bg-zinc-900 border-zinc-800 text-zinc-100 [&>button]:text-zinc-400 [&>button]:hover:text-zinc-100">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 shrink-0">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <DialogTitle className="text-zinc-100">Delete flow</DialogTitle>
            </div>
            <DialogDescription className="text-zinc-400 pt-1">
              Are you sure you want to delete{" "}
              <span className="font-medium text-zinc-200">"{selectedFlow?.name}"</span>?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setDeleteOpen(false)}
              className="flex-1 sm:flex-none px-4 py-2 text-sm rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="flex-1 sm:flex-none px-4 py-2 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white font-medium transition disabled:opacity-50"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete flow"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
