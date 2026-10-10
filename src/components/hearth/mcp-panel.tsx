import { X } from "lucide-react";
import { HEARTH_TOOLS } from "@/lib/hearth/tools";
import { useHearth } from "@/lib/hearth/store";

const SAMPLE = `{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}`;

export function McpPanel() {
  const open = useHearth((s) => s.mcpOpen);
  const setOpen = useHearth((s) => s.setMcpOpen);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end bg-bg/60 sm:items-stretch">
      <button type="button" className="absolute inset-0" aria-label="Close MCP" onClick={() => setOpen(false)} />
      <aside className="relative z-10 flex h-[80vh] w-full max-w-lg flex-col bg-surface shadow-border sm:h-full">
        <header className="flex items-center justify-between px-5 py-4">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-muted">Alexa+ track</div>
            <h2 className="font-display text-2xl tracking-tight">MCP 2025-11-25</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid size-10 place-items-center text-muted hover:text-fg"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-8 text-sm leading-relaxed text-muted">
          <p>
            Self-hosted Streamable HTTP endpoint. POST JSON-RPC to <code className="text-fg">/api/mcp</code>. Same tools
            the living-room Alexa+ overlay uses.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-md bg-elevated p-4 font-mono text-xs text-fg">{SAMPLE}</pre>
          <h3 className="mt-6 font-display text-lg text-fg">Tools</h3>
          <ul className="mt-3 flex flex-col gap-3">
            {HEARTH_TOOLS.map((tool) => (
              <li key={tool.name}>
                <div className="font-mono text-xs text-accent">{tool.name}</div>
                <p className="mt-1 text-sm">{tool.description}</p>
              </li>
            ))}
          </ul>
          <h3 className="mt-6 font-display text-lg text-fg">Resources</h3>
          <p className="mt-2 font-mono text-xs text-fg">
            hearth://household · hearth://people · hearth://bills · hearth://tonight
          </p>
        </div>
      </aside>
    </div>
  );
}
