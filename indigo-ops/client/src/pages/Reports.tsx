import { useEffect, useState } from "react";
import { api } from "../lib/api";

const REPORTS = [
  { key: "daily-flights", label: "Daily Flight Report" },
  { key: "passengers", label: "Passenger Report" },
  { key: "baggage", label: "Baggage Report" },
  { key: "excess-baggage-revenue", label: "Extra Baggage Revenue" },
  { key: "meal-vouchers", label: "Meal Voucher Report" },
  { key: "lounge-usage", label: "Lounge Usage" },
  { key: "boarding", label: "Boarding Report" },
  { key: "no-show", label: "No-show Report" },
  { key: "flight-closure", label: "Flight Closure Report" },
];

export default function Reports() {
  const [active, setActive] = useState(REPORTS[0].key);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  async function run(key: string) {
    setActive(key);
    setRows(await api.get<Record<string, unknown>[]>(`/reports/${key}`));
  }

  useEffect(() => {
    run(REPORTS[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <div className="p-4 space-y-3">
      <div className="text-ops-dim text-[11px] tracking-widest uppercase">OPERATIONS REPORTS</div>
      <div className="flex gap-2 flex-wrap">
        {REPORTS.map((r) => (
          <button key={r.key} onClick={() => run(r.key)} className={`btn ${active === r.key ? "btn-primary" : ""}`}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="panel">
        <div className="panel-header">
          <span>{REPORTS.find((r) => r.key === active)?.label.toUpperCase()}</span>
          <a className="btn" href={`/api/reports/${active}?format=csv`} target="_blank" rel="noreferrer">
            EXPORT CSV
          </a>
        </div>
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="ops-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c}>{String(r[c] ?? "")}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div className="p-3 text-ops-dim text-[12px]">CLICK A REPORT ABOVE TO LOAD DATA</div>}
        </div>
      </div>
    </div>
  );
}
