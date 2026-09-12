import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";

export default function Lounge() {
  const [passes, setPasses] = useState<any[]>([]);
  const toast = useToast();

  async function load() {
    setPasses(await api.get<any[]>("/lounge"));
  }
  useEffect(() => {
    load();
  }, []);

  async function use(id: string) {
    try {
      await api.post(`/lounge/${id}/use`);
      toast.push({ kind: "success", title: "LOUNGE PASS USED" });
      load();
    } catch (e) {
      toast.push({ kind: "error", title: (e as any).title ?? "ACCESS DENIED", message: (e as Error).message });
    }
  }

  return (
    <div className="p-4 space-y-3">
      <div className="text-ops-dim text-[11px] tracking-widest uppercase">LOUNGE PASS MODULE</div>
      <div className="panel">
        <div className="panel-header">
          <span>ALL LOUNGE PASSES</span>
          <span className="text-ops-dim">{passes.length} RECORDS</span>
        </div>
        <table className="ops-table">
          <thead>
            <tr>
              <th>Pass ID</th><th>Passenger</th><th>PNR</th><th>Flight</th><th>Airport</th><th>Access Type</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {passes.map((p) => (
              <tr key={p.id}>
                <td>{p.passId}</td>
                <td>{p.booking.passenger.name}</td>
                <td>{p.booking.pnr}</td>
                <td>{p.flight.flightNumber}</td>
                <td>{p.airport}</td>
                <td>{p.accessType}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>
                  {p.status === "ISSUED" && (
                    <button className="btn" onClick={() => use(p.id)}>
                      USE
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
