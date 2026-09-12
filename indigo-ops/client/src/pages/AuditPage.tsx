import { useEffect, useState } from "react";
import { api, AuditEntry } from "../lib/api";

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [reference, setReference] = useState("");

  async function load() {
    const q = reference ? `?reference=${encodeURIComponent(reference)}` : "";
    setLogs(await api.get<AuditEntry[]>(`/audit${q}`));
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-4 space-y-3">
      <div className="text-ops-dim text-[11px] tracking-widest uppercase">AUDIT LOG — OPERATIONAL TRAIL</div>
      <div className="panel p-3 flex gap-2">
        <input className="input flex-1" placeholder="FILTER BY PNR / FLIGHT NUMBER" value={reference} onChange={(e) => setReference(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        <button className="btn-primary btn" onClick={load}>
          FILTER
        </button>
      </div>
      <div className="panel">
        <div className="max-h-[70vh] overflow-y-auto font-mono text-[12px]">
          {logs.map((l) => (
            <div key={l.id} className="border-b border-ops-border/40 px-3 py-1.5">
              <span className="text-ops-dim">{new Date(l.timestamp).toLocaleTimeString("en-GB", { hour12: false })}</span>{" "}
              <span className="badge badge-cyan mx-1">{l.category}</span>
              {l.reference && <span className="text-ops-indigoBright mr-1">{l.reference}</span>}
              <span>{l.message}</span>
            </div>
          ))}
          {logs.length === 0 && <div className="p-3 text-ops-dim">NO AUDIT ENTRIES</div>}
        </div>
      </div>
    </div>
  );
}
