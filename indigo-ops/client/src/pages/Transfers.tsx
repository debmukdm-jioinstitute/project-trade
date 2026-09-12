import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";

export default function Transfers() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    api.get<any[]>("/transfers").then(setRows);
  }, []);

  return (
    <div className="p-4 space-y-3">
      <div className="text-ops-dim text-[11px] tracking-widest uppercase">TRANSFER PASSENGERS</div>
      <div className="panel">
        <table className="ops-table">
          <thead>
            <tr>
              <th>PNR</th><th>Passenger</th><th>Inbound</th><th>Outbound</th><th>Connection</th><th>Next Gate</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.pnr}</td>
                <td>{r.passenger}</td>
                <td>{r.inboundFlight}</td>
                <td>{r.outboundFlight}</td>
                <td className={r.shortConnection ? "text-ops-amber" : ""}>
                  {r.connectionMinutes} MIN {r.shortConnection && "⚠"}
                </td>
                <td>{r.nextGate}</td>
                <td><StatusBadge status={r.boardingStatus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-3 text-ops-dim text-[12px]">NO TRANSFER PASSENGERS</div>}
      </div>
    </div>
  );
}
