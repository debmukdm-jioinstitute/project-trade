import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";

interface VerifyResult {
  valid: boolean;
  reason?: string;
  documentType?: string;
  passenger?: string;
  flight?: string;
  status?: string;
  issued?: string;
  expiry?: string;
}

export default function Verify() {
  const [params] = useSearchParams();
  const [payload, setPayload] = useState(params.get("payload") ?? "");
  const [result, setResult] = useState<VerifyResult | null>(null);

  async function verify() {
    if (!payload.trim()) return;
    setResult(await api.get<VerifyResult>(`/documents/verify?payload=${encodeURIComponent(payload)}`));
  }

  useEffect(() => {
    if (params.get("payload")) verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="p-4 space-y-3">
      <div className="text-ops-dim text-[11px] tracking-widest uppercase">OPS&gt; VERIFY QR</div>
      <div className="panel p-3 flex gap-2 max-w-xl">
        <input
          className="input flex-1"
          placeholder="6E|BP|A7K9PQ|001"
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && verify()}
        />
        <button className="btn-primary btn" onClick={verify}>
          VERIFY
        </button>
      </div>

      {result && (
        <div className="panel p-4 max-w-xl">
          <div className={`text-lg font-bold mb-3 ${result.valid ? "text-ops-green" : "text-ops-red"}`}>
            {result.valid ? "DOCUMENT VALID" : "DOCUMENT INVALID"}
          </div>
          {result.reason && <div className="text-ops-red text-[12px] mb-2">{result.reason}</div>}
          {result.documentType && (
            <div className="text-[12px] space-y-1">
              <Row label="Document Type" value={result.documentType} />
              <Row label="Passenger" value={result.passenger ?? "-"} />
              <Row label="Flight" value={result.flight ?? "-"} />
              <Row label="Status" value={result.status ?? "-"} />
              <Row label="Issued" value={result.issued ?? "-"} />
              <Row label="Expiry" value={result.expiry ?? "-"} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-ops-border/40 py-1">
      <span className="text-ops-dim">{label}</span>
      <span>{value}</span>
    </div>
  );
}
