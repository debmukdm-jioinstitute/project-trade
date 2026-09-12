import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

interface SearchResult {
  kind: string;
  label: string;
  sub: string;
  href: string;
}

export function GlobalSearch({ onClose, onNavigate }: { onClose: () => void; onNavigate: (target: string) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const data = await api.get<{ results: SearchResult[] }>(`/search?q=${encodeURIComponent(q)}`);
      setResults(data.results);
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/80 pt-20" onMouseDown={onClose}>
      <div className="panel w-[600px] max-h-[70vh] flex flex-col shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="panel-header">
          <span>GLOBAL SEARCH</span>
          <span className="text-ops-dim">[ESC] CLOSE</span>
        </div>
        <div className="p-3 border-b border-ops-border">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && results[0]) {
                onNavigate(results[0].href);
              }
            }}
            className="input w-full"
            placeholder="PNR, passenger, flight, bag tag, boarding pass, voucher, lounge pass..."
            autoComplete="off"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {results.length === 0 && q.trim() && <div className="p-3 text-ops-dim text-[12px]">NO RESULTS</div>}
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => onNavigate(r.href)}
              className="w-full text-left px-3 py-2 border-b border-ops-border/60 hover:bg-ops-panel2 flex items-center justify-between"
            >
              <div>
                <div className="text-ops-text text-[12px]">{r.label}</div>
                <div className="text-ops-dim text-[11px]">{r.sub}</div>
              </div>
              <span className="badge badge-dim">{r.kind}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
