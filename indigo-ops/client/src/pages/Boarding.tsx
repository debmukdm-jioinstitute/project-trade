import { useCallback, useEffect, useState } from "react";
import { api, FlightRow } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";

interface BoardingSummary {
  totalPax: number;
  checkedIn: number;
  boarded: number;
  remaining: number;
  passengers: { bookingId: string; pnr: string; name: string; seat: string; sequenceNumber: number | null; boardingGroup: string; status: string }[];
}

export default function Boarding() {
  const [flights, setFlights] = useState<FlightRow[]>([]);
  const [flightId, setFlightId] = useState("");
  const [summary, setSummary] = useState<BoardingSummary | null>(null);
  const toast = useToast();

  useEffect(() => {
    api.get<FlightRow[]>("/flights").then((fs) => {
      setFlights(fs);
      const active = fs.find((f) => ["BOARDING", "FINAL CALL", "CHECK-IN OPEN"].includes(f.status));
      if (active) selectFlight(active.id);
    });
  }, []);

  const selectFlight = useCallback(async (id: string) => {
    setFlightId(id);
    if (!id) return setSummary(null);
    setSummary(await api.get<BoardingSummary>(`/boarding/${id}/summary`));
  }, []);

  async function action(path: string, bookingId: string, okMsg: string) {
    try {
      await api.post(`/boarding/${path}/${bookingId}`);
      toast.push({ kind: "success", title: okMsg });
      selectFlight(flightId);
    } catch (e) {
      toast.push({ kind: "error", title: (e as any).title ?? "ACTION FAILED", message: (e as Error).message });
    }
  }

  const flight = flights.find((f) => f.id === flightId);

  return (
    <div className="p-4 space-y-3">
      <div className="text-ops-dim text-[11px] tracking-widest uppercase">BOARDING MANAGEMENT — GATE CONSOLE</div>
      <div className="panel p-3">
        <select className="input" value={flightId} onChange={(e) => selectFlight(e.target.value)}>
          <option value="">SELECT FLIGHT</option>
          {flights.map((f) => (
            <option key={f.id} value={f.id}>
              {f.flightNumber} {f.origin}→{f.destination} — {f.status}
            </option>
          ))}
        </select>
      </div>

      {flight && summary && (
        <>
          <div className="panel p-3 flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">
                FLIGHT {flight.flightNumber} &nbsp; {flight.origin} → {flight.destination}
              </div>
              <div className="text-ops-dim text-[11px]">GATE {flight.gate?.code ?? "UNASSIGNED"}</div>
            </div>
            <StatusBadge status={flight.status} />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Total Pax" value={summary.totalPax} />
            <Stat label="Checked In" value={summary.checkedIn} />
            <Stat label="Boarded" value={summary.boarded} tone="green" />
            <Stat label="Remaining" value={summary.remaining} tone="amber" />
          </div>
          <div className="panel">
            <div className="panel-header"><span>PASSENGER LIST</span></div>
            <div className="max-h-[55vh] overflow-y-auto">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>PNR</th><th>Name</th><th>Seat</th><th>Sequence</th><th>Group</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.passengers.map((p) => (
                    <tr key={p.bookingId}>
                      <td>{p.pnr}</td>
                      <td>{p.name}</td>
                      <td>{p.seat}</td>
                      <td>{p.sequenceNumber ?? "-"}</td>
                      <td>{p.boardingGroup}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td className="flex gap-1">
                        {p.status !== "BOARDED" && (
                          <button className="btn" onClick={() => action("board", p.bookingId, "PASSENGER BOARDED")}>BOARD</button>
                        )}
                        {p.status === "BOARDED" && (
                          <button className="btn" onClick={() => action("undo", p.bookingId, "BOARDING UNDONE")}>UNDO</button>
                        )}
                        <button className="btn" onClick={() => action("no-show", p.bookingId, "MARKED NO-SHOW")}>NO-SHOW</button>
                        <button className="btn-danger btn" onClick={() => action("offload", p.bookingId, "OFFLOADED")}>OFFLOAD</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "green" | "amber" }) {
  const cls = tone === "green" ? "text-ops-green" : tone === "amber" ? "text-ops-amber" : "";
  return (
    <div className="panel px-3 py-2">
      <div className="text-[10px] text-ops-dim uppercase">{label}</div>
      <div className={`text-xl ${cls}`}>{value}</div>
    </div>
  );
}
