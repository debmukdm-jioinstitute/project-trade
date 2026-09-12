import { useEffect, useState, useCallback } from "react";
import { api, FlightRow } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";

interface Checklist {
  checklist: Record<string, boolean>;
  ready: boolean;
  mismatches: string[];
}

export default function Departure() {
  const [flights, setFlights] = useState<FlightRow[]>([]);
  const [flightId, setFlightId] = useState("");
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const toast = useToast();

  useEffect(() => {
    api.get<FlightRow[]>("/flights").then(setFlights);
  }, []);

  const select = useCallback(async (id: string) => {
    setFlightId(id);
    if (!id) return setChecklist(null);
    setChecklist(await api.get<Checklist>(`/flights/${id}/checklist`));
  }, []);

  async function markDeparted() {
    try {
      await api.post(`/flights/${flightId}/departed`);
      toast.push({ kind: "success", title: "FLIGHT MARKED DEPARTED" });
      select(flightId);
      api.get<FlightRow[]>("/flights").then(setFlights);
    } catch (e) {
      toast.push({ kind: "error", title: (e as any).title ?? "DEPARTURE DENIED", message: (e as Error).message });
    }
  }

  const flight = flights.find((f) => f.id === flightId);

  return (
    <div className="p-4 space-y-3">
      <div className="text-ops-dim text-[11px] tracking-widest uppercase">FLIGHT DEPARTURE CONTROL</div>
      <div className="panel p-3">
        <select className="input" value={flightId} onChange={(e) => select(e.target.value)}>
          <option value="">SELECT FLIGHT</option>
          {flights.map((f) => (
            <option key={f.id} value={f.id}>
              {f.flightNumber} {f.origin}→{f.destination} — {f.status}
            </option>
          ))}
        </select>
      </div>

      {flight && checklist && (
        <div className="panel p-3 max-w-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">{flight.flightNumber}</div>
            <StatusBadge status={flight.status} />
          </div>
          <div className="space-y-1 text-[13px]">
            {Object.entries(checklist.checklist).map(([k, v]) => (
              <div key={k} className={v ? "text-ops-green" : "text-ops-red"}>
                [{v ? "✓" : "✗"}] {k.replace(/([A-Z])/g, " $1").trim().toUpperCase()}
              </div>
            ))}
          </div>
          {checklist.mismatches.length > 0 && (
            <div className="text-ops-amber text-[12px]">⚠ BAG/PASSENGER MISMATCH — resolve before departure.</div>
          )}
          <button className="btn" onClick={() => select(flightId)}>REFRESH</button>
          <button className="btn-primary btn w-full" disabled={!checklist.ready || flight.status === "DEPARTED"} onClick={markDeparted}>
            MARK DEPARTED
          </button>
        </div>
      )}
    </div>
  );
}
