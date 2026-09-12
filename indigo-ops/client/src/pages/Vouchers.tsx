import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { StatusBadge } from "../components/StatusBadge";
import { useToast } from "../components/Toast";

export default function Vouchers() {
  const [vouchers, setVouchers] = useState<any[]>([]);
  const toast = useToast();

  async function load() {
    setVouchers(await api.get<any[]>("/vouchers"));
  }
  useEffect(() => {
    load();
  }, []);

  async function redeem(id: string) {
    try {
      await api.post(`/vouchers/${id}/redeem`);
      toast.push({ kind: "success", title: "VOUCHER REDEEMED" });
      load();
    } catch (e) {
      toast.push({ kind: "error", title: (e as any).title ?? "REDEEM FAILED", message: (e as Error).message });
    }
  }

  return (
    <div className="p-4 space-y-3">
      <div className="text-ops-dim text-[11px] tracking-widest uppercase">MEAL VOUCHER MODULE</div>
      <div className="panel">
        <div className="panel-header">
          <span>ALL MEAL VOUCHERS</span>
          <span className="text-ops-dim">{vouchers.length} RECORDS</span>
        </div>
        <table className="ops-table">
          <thead>
            <tr>
              <th>Voucher No.</th><th>Passenger</th><th>PNR</th><th>Flight</th><th>Meal Type</th><th>Validity</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {vouchers.map((v) => (
              <tr key={v.id}>
                <td>{v.voucherNo}</td>
                <td>{v.booking.passenger.name}</td>
                <td>{v.booking.pnr}</td>
                <td>{v.flight.flightNumber}</td>
                <td>{v.mealType}</td>
                <td>{v.validity}</td>
                <td><StatusBadge status={v.status} /></td>
                <td>
                  {v.status === "ISSUED" && (
                    <button className="btn" onClick={() => redeem(v.id)}>
                      REDEEM
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
