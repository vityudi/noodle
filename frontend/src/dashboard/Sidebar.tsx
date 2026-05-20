import { FolderOpen, KeyRound, FileCode2, ScrollText, Settings, LogOut } from "lucide-react";

export type SidebarPage = "projects" | "credentials" | "logs" | "schema" | "settings";

interface Props {
  active: SidebarPage;
  onNavigate: (page: SidebarPage) => void;
  onLogout: () => void;
}

const NAV: Array<{ id: SidebarPage; label: string; icon: React.ElementType }> = [
  { id: "projects",    label: "Projects",    icon: FolderOpen },
  { id: "credentials", label: "Credentials", icon: KeyRound },
  { id: "logs",        label: "Logs",        icon: ScrollText },
  { id: "schema",      label: "Schema",      icon: FileCode2 },
];

export function Sidebar({ active, onNavigate, onLogout }: Props) {
  return (
    <aside className="w-56 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col h-screen">
      <div className="px-5 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-lg">🍜</span>
          <span className="font-semibold text-zinc-100 text-sm">Noodle</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition text-left ${
              active === id
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-zinc-800 space-y-0.5">
        <button
          onClick={() => onNavigate("settings")}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition text-left ${
            active === "settings"
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50"
          }`}
        >
          <Settings size={15} />
          Settings
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 transition"
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
