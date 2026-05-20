import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { aiApi, flowsApi, projectsApi, type Project } from "@/lib/api";
import { Sparkles, X, Send, ChevronDown, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Message {
  role: "user" | "assistant";
  text: string;
  flow?: Record<string, unknown>;
  saved?: boolean;
  projectId?: string;
}

interface Props {
  onOpenProject: (project: Project) => void;
}

export function GlobalAIChat({ onOpenProject }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
    enabled: open,
  });

  const selectedProject = projects.find((p) => p.id === projectId) ?? projects[0];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    if (!input.trim() || !selectedProject || loading) return;
    const userText = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", text: userText }]);
    setLoading(true);

    try {
      const flow = await aiApi.generate(selectedProject.id, userText) as Record<string, unknown>;
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: `Generated **${flow.name as string}** — ${(flow.nodes as unknown[])?.length ?? 0} nodes`,
          flow,
          projectId: selectedProject.id,
        },
      ]);
    } catch (e: unknown) {
      const err =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        "Generation failed. Check AI settings.";
      setMessages((m) => [...m, { role: "assistant", text: `Error: ${err}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function saveFlow(msg: Message, index: number) {
    if (!msg.flow || !msg.projectId) return;
    const proj = projects.find((p) => p.id === msg.projectId);
    if (!proj) return;

    const name = (msg.flow.name as string) || "ai_flow";
    const description = (msg.flow.description as string) || "";
    await flowsApi.create(msg.projectId, { name, description, flow_json: msg.flow });
    qc.invalidateQueries({ queryKey: ["flows", msg.projectId] });

    setMessages((m) =>
      m.map((item, i) => (i === index ? { ...item, saved: true } : item))
    );
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {/* Panel */}
      {open && (
        <div className="w-[380px] h-[540px] flex flex-col rounded-2xl overflow-hidden shadow-2xl shadow-black/60 border border-white/[0.08] bg-[#18181b]">
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.07] bg-[#1c1c1f]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <Sparkles size={13} className="text-violet-400" />
              </div>
              <span className="text-sm font-semibold text-zinc-100">AI Assistant</span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedProject?.id ?? ""} onValueChange={setProjectId}>
                <SelectTrigger className="bg-zinc-800 border-white/10 text-zinc-300 text-xs h-7 max-w-[130px] focus:ring-zinc-600 focus:ring-offset-zinc-900">
                  <SelectValue placeholder="No projects" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700 text-zinc-100">
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300 transition">
                <ChevronDown size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <Sparkles size={20} className="text-violet-400" />
                </div>
                <p className="text-sm font-medium text-zinc-300">What would you like to build?</p>
                <p className="text-xs text-zinc-500">Describe a tool and I'll generate the flow for you.</p>
                <div className="w-full space-y-1.5 mt-2">
                  {[
                    "Fetch a customer by email from my API",
                    "Health check for a service URL",
                    "Authenticated API call with Bearer token",
                  ].map((ex) => (
                    <button
                      key={ex}
                      onClick={() => setInput(ex)}
                      className="w-full text-left text-xs text-zinc-400 bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-2 hover:bg-white/[0.07] hover:text-zinc-300 transition"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "user" ? (
                    <div className="max-w-[80%] bg-violet-600 text-white text-sm px-3.5 py-2 rounded-2xl rounded-br-sm">
                      {msg.text}
                    </div>
                  ) : (
                    <div className="max-w-[90%] bg-white/[0.05] border border-white/[0.08] rounded-2xl rounded-bl-sm p-3 space-y-2.5">
                      <p className="text-sm text-zinc-200">{msg.text}</p>
                      {msg.flow && (
                        <div className="flex gap-2">
                          {msg.saved ? (
                            <button
                              onClick={() => {
                                const proj = projects.find((p) => p.id === msg.projectId);
                                if (proj) onOpenProject(proj);
                              }}
                              className="flex items-center gap-1.5 text-xs text-green-400 border border-green-800/60 rounded-lg px-3 py-1.5 hover:bg-green-950/30 transition"
                            >
                              <Check size={12} />
                              Open in builder
                            </button>
                          ) : (
                            <button
                              onClick={() => saveFlow(msg, i)}
                              className="flex items-center gap-1.5 text-xs text-white bg-violet-600 hover:bg-violet-500 rounded-lg px-3 py-1.5 transition"
                            >
                              Save to project
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-white/[0.07] p-3">
            <div className="flex items-end gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                rows={1}
                placeholder="Describe the tool you want to build…"
                className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none resize-none leading-relaxed"
                style={{ maxHeight: 80 }}
              />
              <button
                onClick={send}
                disabled={!input.trim() || !selectedProject || loading}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={13} />
              </button>
            </div>
            <p className="text-[10px] text-zinc-600 mt-1.5 text-center">Enter to send · Shift+Enter for new line</p>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`
          w-12 h-12 rounded-full shadow-lg shadow-black/40 flex items-center justify-center
          transition-all duration-200
          ${open
            ? "bg-zinc-800 border border-white/10 text-zinc-400 hover:text-zinc-200"
            : "bg-violet-600 hover:bg-violet-500 text-white shadow-violet-900/40"}
        `}
      >
        {open ? <X size={18} /> : <Sparkles size={18} />}
      </button>
    </div>
  );
}
