import { useState } from "react";
import { projectsApi, type Project } from "@/lib/api";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (project: Project) => void;
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function CreateProjectDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(value));
    }
  }

  function handleClose(open: boolean) {
    if (!open) {
      setName("");
      setSlug("");
      setDescription("");
      setError("");
    }
    onOpenChange(open);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const project = await projectsApi.create({ name, slug, description });
      onCreated(project);
      handleClose(false);
    } catch {
      setError("Could not create project. Slug may already be taken.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-semibold text-zinc-100">
              New MCP project
            </Dialog.Title>
            <Dialog.Close className="text-zinc-500 hover:text-zinc-300 transition">
              <X size={18} />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-300 mb-1">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                placeholder="My CRM"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-300 mb-1">Slug</label>
              <div className="flex items-center bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 gap-1 focus-within:border-zinc-500">
                <span className="text-zinc-500 text-sm shrink-0">/mcp/</span>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="flex-1 bg-transparent text-zinc-100 text-sm focus:outline-none min-w-0"
                  placeholder="my-crm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-zinc-300 mb-1">
                Description{" "}
                <span className="text-zinc-500">(optional)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 text-sm placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                placeholder="Integrate with our CRM API"
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Dialog.Close className="flex-1 border border-zinc-700 text-zinc-300 font-medium rounded-lg py-2 text-sm hover:bg-zinc-800 transition">
                Cancel
              </Dialog.Close>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-white text-zinc-900 font-medium rounded-lg py-2 text-sm hover:bg-zinc-200 transition disabled:opacity-50"
              >
                {loading ? "Creating…" : "Create project"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
