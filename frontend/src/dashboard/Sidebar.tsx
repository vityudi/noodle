import { FolderOpen, KeyRound, FileCode2, LogOut } from "lucide-react";

export type SidebarPage = "projects" | "credentials" | "schema";

interface Props {
  active: SidebarPage;
  onNavigate: (page: SidebarPage) => void;
  onLogout: () => void;
}

const NAV = [
  { id: "projects" as SidebarPage, label: "Projects", icon: FolderOpen },
  { id: "credentials" as SidebarPage, label: "Credentials", icon: KeyRound },
  { id: "schema" as SidebarPage, label: "Schema", icon: FileCode2 },
];

export function Sidebar({ active, onNavigate, onLogout }: Props) {
  return (
    <aside className="w-56 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col h-screen">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-lg">🍜</span>
          <span className="font-semibold text-zinc-100 text-sm">Noodle</span>
        </div>
      </div>

      {/* Nav */}
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

      {/* Footer */}
      <div className="px-3 py-4 border-t border-zinc-800">
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
