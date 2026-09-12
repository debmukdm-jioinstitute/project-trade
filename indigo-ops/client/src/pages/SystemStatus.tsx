import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function SystemStatus() {
  const [status, setStatus] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    api.get<Record<string, string>>("/system/status").then(setStatus);
  }, []);

  const engines = status
    ? Object.entries(status).filter(([k]) => !["mode", "timestamp"].includes(k))
    : [];

  return (
    <div className="p-4 space-y-3">
      <div className="text-ops-dim text-[11px] tracking-widest uppercase">SYSTEM STATUS</div>
      <div className="panel p-4 max-w-lg font-mono text-[13px] space-y-1">
        <div className="text-ops-indigoBright mb-2">OPS&gt; SYSTEM STATUS</div>
        {engines.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-ops-border/40 py-1">
            <span>{k}:</span>
            <span className={v === "ONLINE" ? "text-ops-green" : "text-ops-red"}>{v}</span>
          </div>
        ))}
        {status && (
          <>
            <div className="text-ops-amber mt-3">{status.mode}</div>
            <div className="text-ops-dim text-[11px]">{status.timestamp}</div>
          </>
        )}
      </div>
    </div>
  );
}
