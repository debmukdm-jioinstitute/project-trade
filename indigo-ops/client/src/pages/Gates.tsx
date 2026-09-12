import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";

export default function Gates() {
  const [gates, setGates] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<any[]>("/gates").then(setGates);
  }, []);

  return (
    <div className="p-4 space-y-3">
      <div className="text-ops-dim text-[11px] tracking-widest uppercase">GATE MANAGEMENT</div>
      <div className="panel">
        <div className="panel-header"><span>ALL GATES</span></div>
        <table className="ops-table">
          <thead>
            <tr>
              <th>Gate</th><th>Terminal</th><th>Status</th><th>Active Flight</th>
            </tr>
          </thead>
          <tbody>
            {gates.map((g) => (
              <tr key={g.id} onClick={() => g.flights[0] && navigate(`/flights/${g.flights[0].id}`)}>
                <td className="font-semibold">{g.code}</td>
                <td>{g.terminal}</td>
                <td><StatusBadge status={g.status} /></td>
                <td>{g.flights[0]?.flightNumber ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
