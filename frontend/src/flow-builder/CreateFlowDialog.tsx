import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { flowsApi, templatesApi, type Flow, type FlowTemplate } from "@/lib/api";
import * as Dialog from "@radix-ui/react-dialog";
import { X, FileText, Globe, Activity, Lock } from "lucide-react";

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (flow: Flow) => void;
}

type Tab = "blank" | "template" | "import";

const CATEGORY_ICON: Record<string, React.ElementType> = {
  HTTP: Globe,
  Monitoring: Activity,
  Auth: Lock,
};

function TemplateCard({
  template,
  selected,
  onClick,
}: {
  template: FlowTemplate;
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = CATEGORY_ICON[template.category] ?? FileText;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition ${
        selected
          ? "border-white bg-zinc-800"
          : "border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/50"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon size={13} className="text-zinc-400 shrink-0" />
        <span className="text-sm font-medium text-zinc-100">{template.name}</span>
        <span className="text-xs text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded ml-auto">
          {template.category}
        </span>
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed">{template.description}</p>
    </button>
  );
}

export function CreateFlowDialog({ projectId, open, onOpenChange, onCreated }: Props) {
  const [tab, setTab] = useState<Tab>("blank");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<FlowTemplate | null>(null);
  const [importJSON, setImportJSON] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: templateList = [] } = useQuery({
    queryKey: ["templates"],
    queryFn: templatesApi.list,
    enabled: open,
  });

  function reset() {
    setTab("blank");
    setName("");
    setDescription("");
    setSelectedTemplate(null);
    setImportJSON("");
    setError("");
  }

  function handleClose(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  async function handleCreate() {
    setError("");
    setLoading(true);
    try {
      let flowJSON: object | undefined;

      if (tab === "template") {
        if (!selectedTemplate) { setError("Select a template."); setLoading(false); return; }
        const tplFlow = selectedTemplate.flow as Record<string, unknown>;
        flowJSON = { ...tplFlow, name: name || (tplFlow.name as string) };
      } else if (tab === "import") {
        try {
          flowJSON = JSON.parse(importJSON);
        } catch {
          setError("Invalid JSON."); setLoading(false); return;
        }
      }

      const flowName = name || (tab === "template" && selectedTemplate
        ? (selectedTemplate.flow as Record<string, unknown>).name as string
        : "untitled_flow");

      const flow = await flowsApi.create(projectId, {
        name: flowName,
        description,
        ...(flowJSON ? { flow_json: flowJSON } : {}),
      });

      onCreated(flow);
      handleClose(false);
    } catch {
      setError("Could not create flow.");
    } finally {
      setLoading(false);
    }
  }

  const canCreate =
    tab === "blank" ? !!name :
    tab === "template" ? !!selectedTemplate :
    tab === "import" ? !!importJSON :
    false;

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 shrink-0">
            <Dialog.Title className="text-lg font-semibold text-zinc-100">New flow</Dialog.Title>
            <Dialog.Close className="text-zinc-500 hover:text-zinc-300 transition">
              <X size={18} />
            </Dialog.Close>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-6 pt-4 shrink-0">
            {(["blank", "template", "import"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-sm rounded-md transition capitalize ${
                  tab === t
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t === "import" ? "Import JSON" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Name (always shown except pure import) */}
            {tab !== "import" && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                  Flow name {tab === "template" && <span className="text-zinc-600">(leave blank to use template name)</span>}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  placeholder={tab === "blank" ? "find_customer" : "Optional override"}
                  autoFocus={tab === "blank"}
                  required={tab === "blank"}
                />
              </div>
            )}

            {tab === "blank" && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                  Description <span className="text-zinc-600">(optional)</span>
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  placeholder="Finds a customer by email"
                />
              </div>
            )}

            {tab === "template" && (
              <div className="space-y-2">
                {templateList.length === 0 ? (
                  <p className="text-zinc-500 text-sm">Loading templates…</p>
                ) : (
                  templateList.map((t) => (
                    <TemplateCard
                      key={t.id}
                      template={t}
                      selected={selectedTemplate?.id === t.id}
                      onClick={() => setSelectedTemplate(t)}
                    />
                  ))
                )}
              </div>
            )}

            {tab === "import" && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5 font-medium">
                  Paste flow JSON
                </label>
                <textarea
                  value={importJSON}
                  onChange={(e) => setImportJSON(e.target.value)}
                  rows={12}
                  spellCheck={false}
                  autoFocus
                  placeholder={'{\n  "schema_version": "1.0",\n  "name": "my_flow",\n  ...\n}'}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none"
                />
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-zinc-800 shrink-0">
            <Dialog.Close className="flex-1 border border-zinc-700 text-zinc-300 font-medium rounded-lg py-2 text-sm hover:bg-zinc-800 transition">
              Cancel
            </Dialog.Close>
            <button
              onClick={handleCreate}
              disabled={!canCreate || loading}
              className="flex-1 bg-white text-zinc-900 font-medium rounded-lg py-2 text-sm hover:bg-zinc-200 transition disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
