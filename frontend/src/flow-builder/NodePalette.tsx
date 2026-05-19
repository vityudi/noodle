import { Globe, Braces, GitBranch, Zap } from "lucide-react";

const NODES = [
  {
    type: "trigger",
    label: "Trigger",
    icon: Zap,
    color: "text-violet-400",
    description: "Flow entry point",
  },
  {
    type: "httpRequest",
    label: "HTTP Request",
    icon: Globe,
    color: "text-blue-400",
    description: "Call any REST API",
  },
  {
    type: "jsonTransform",
    label: "JSON Transform",
    icon: Braces,
    color: "text-amber-400",
    description: "Remap or filter JSON",
  },
  {
    type: "condition",
    label: "Condition",
    icon: GitBranch,
    color: "text-green-400",
    description: "If / else branching",
  },
];

function PaletteItem({
  type,
  label,
  icon: Icon,
  color,
  description,
}: (typeof NODES)[number]) {
  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("nodeType", type);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex items-center gap-3 p-3 bg-zinc-800/60 border border-zinc-700/50 rounded-lg cursor-grab active:cursor-grabbing hover:bg-zinc-800 hover:border-zinc-600 transition select-none"
    >
      <Icon size={16} className={color} />
      <div>
        <div className="text-sm text-zinc-100 font-medium">{label}</div>
        <div className="text-xs text-zinc-500">{description}</div>
      </div>
    </div>
  );
}

export function NodePalette() {
  return (
    <aside className="w-56 border-r border-zinc-800 bg-zinc-950 flex flex-col shrink-0 overflow-y-auto">
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Nodes</p>
      </div>
      <div className="px-3 pb-4 space-y-2">
        {NODES.map((node) => (
          <PaletteItem key={node.type} {...node} />
        ))}
      </div>
    </aside>
  );
}
