import { useEffect, useState } from "react";
import { api, FlightRow } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";

interface Reconciliation {
  totalChecked: number;
  totalLoaded: number;
  unloaded: number;
  transferBags: number;
  missing: number;
  mismatches: number;
  rows: { bagId: string; tagNumber: string; passenger: string; pnr: string; weightKg: number; status: string; boarded: boolean; mismatch: boolean }[];
}

export default function Baggage() {
  const [tag, setTag] = useState("");
  const [bag, setBag] = useState<any>(null);
  const [flights, setFlights] = useState<FlightRow[]>([]);
  const [flightId, setFlightId] = useState("");
  const [recon, setRecon] = useState<Reconciliation | null>(null);
  const toast = useToast();

  useEffect(() => {
    api.get<FlightRow[]>("/flights").then(setFlights);
  }, []);

  async function lookupTag() {
    try {
      setBag(await api.get(`/baggage/tag/${tag.toUpperCase()}`));
    } catch (e) {
      setBag(null);
      toast.push({ kind: "error", title: "BAG NOT FOUND", message: (e as Error).message });
    }
  }

  async function loadRecon(id: string) {
    setFlightId(id);
    if (!id) {
      setRecon(null);
      return;
    }
    setRecon(await api.get<Reconciliation>(`/baggage/reconcile/${id}`));
  }

  async function setStatus(bagId: string, status: string) {
    try {
      await api.post(`/baggage/${bagId}/status`, { status });
      toast.push({ kind: "success", title: `BAG -> ${status}` });
      loadRecon(flightId);
    } catch (e) {
      toast.push({ kind: "error", title: "ACTION FAILED", message: (e as Error).message });
    }
  }

  return (
    <div className="p-4 space-y-3">
      <div className="text-ops-dim text-[11px] tracking-widest uppercase">BAGGAGE MANAGEMENT</div>

      <div className="panel p-3 flex gap-2">
        <input className="input flex-1" placeholder="BAG TAG NUMBER" value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookupTag()} />
        <button className="btn-primary btn" onClick={lookupTag}>
          LOOKUP TAG
        </button>
      </div>

      {bag && (
        <div className="panel p-3 text-[12px] grid grid-cols-2 gap-1">
          <span className="text-ops-dim">TAG</span><span>{bag.tagNumber}</span>
          <span className="text-ops-dim">PASSENGER</span><span>{bag.booking.passenger.name}</span>
          <span className="text-ops-dim">PNR</span><span>{bag.booking.pnr}</span>
          <span className="text-ops-dim">FLIGHT</span><span>{bag.booking.flight.flightNumber}</span>
          <span className="text-ops-dim">WEIGHT</span><span>{bag.weightKg} KG</span>
          <span className="text-ops-dim">DESTINATION</span><span>{bag.destination}</span>
          <span className="text-ops-dim">STATUS</span><span><StatusBadge status={bag.status} /></span>
        </div>
      )}

      <div className="panel p-3">
        <div className="text-[11px] text-ops-dim uppercase mb-2">Baggage Reconciliation by Flight</div>
        <select className="input" value={flightId} onChange={(e) => loadRecon(e.target.value)}>
          <option value="">SELECT FLIGHT</option>
          {flights.map((f) => (
            <option key={f.id} value={f.id}>
              {f.flightNumber} {f.origin}→{f.destination}
            </option>
          ))}
        </select>
      </div>

      {recon && (
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-3">
            <Stat label="Checked" value={recon.totalChecked} />
            <Stat label="Loaded" value={recon.totalLoaded} tone="green" />
            <Stat label="Unloaded" value={recon.unloaded} tone="amber" />
            <Stat label="Transfer" value={recon.transferBags} />
            <Stat label="Mismatches" value={recon.mismatches} tone="red" />
          </div>
          <div className="panel">
            <div className="panel-header"><span>PASSENGER-LEVEL RECONCILIATION</span></div>
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Tag</th><th>Passenger</th><th>PNR</th><th>Weight</th><th>Status</th><th>Boarded</th><th></th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recon.rows.map((r) => (
                  <tr key={r.bagId}>
                    <td>{r.tagNumber}</td>
                    <td>{r.passenger}</td>
                    <td>{r.pnr}</td>
                    <td>{r.weightKg} KG</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>{r.boarded ? "YES" : "NO"}</td>
                    <td>{r.mismatch && <span className="text-ops-red">⚠ MISMATCH</span>}</td>
                    <td className="flex gap-1">
                      <button className="btn" onClick={() => setStatus(r.bagId, "HELD")}>HOLD</button>
                      <button className="btn" onClick={() => setStatus(r.bagId, "UNLOADED")}>UNLOAD</button>
                      <button className="btn" onClick={() => setStatus(r.bagId, "LOADED")}>CLEAR</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "green" | "amber" | "red" }) {
  const cls = tone === "green" ? "text-ops-green" : tone === "amber" ? "text-ops-amber" : tone === "red" ? "text-ops-red" : "";
  return (
    <div className="panel px-3 py-2">
      <div className="text-[10px] text-ops-dim uppercase">{label}</div>
      <div className={`text-xl ${cls}`}>{value}</div>
    </div>
  );
}
