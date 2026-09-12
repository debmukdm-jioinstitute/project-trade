import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, DashboardData } from "../lib/api";
import { Modal } from "./Modal";
import { StatusBadge } from "./StatusBadge";
import { fmtMoney } from "../lib/status";

export type StatKind =
  | "SCHEDULED"
  | "BOARDING"
  | "DEPARTED"
  | "ARRIVED"
  | "DELAYED"
  | "CANCELLED"
  | "CHECKED_IN"
  | "BOARDED"
  | "BAGS_CHECKED"
  | "BAGS_LOADED"
  | "EXCESS_REVENUE"
  | "MEAL_VOUCHERS"
  | "LOUNGE_PASSES";

type FlightBoardRow = DashboardData["board"][number];

const FLIGHT_KINDS: Record<string, { title: string; filter: (f: FlightBoardRow) => boolean }> = {
  SCHEDULED: { title: "SCHEDULED FLIGHTS — TODAY", filter: () => true },
  BOARDING: { title: "FLIGHTS BOARDING", filter: (f) => ["BOARDING", "FINAL CALL"].includes(f.status) },
  DEPARTED: {
    title: "FLIGHTS DEPARTED",
    filter: (f) => ["DEPARTED", "AIRBORNE", "LANDED", "AT GATE", "DISEMBARKATION", "COMPLETED", "CLOSED"].includes(f.status),
  },
  ARRIVED: {
    title: "FLIGHTS ARRIVED",
    filter: (f) => ["LANDED", "AT GATE", "DISEMBARKATION", "COMPLETED", "CLOSED"].includes(f.status),
  },
  DELAYED: { title: "DELAYED FLIGHTS", filter: (f) => f.status === "DELAYED" },
  CANCELLED: { title: "CANCELLED FLIGHTS", filter: (f) => f.status === "CANCELLED" },
};

export function StatDetailModal({ kind, date, board, onClose }: { kind: StatKind; date: string; board: FlightBoardRow[]; onClose: () => void }) {
  const navigate = useNavigate();

  if (kind in FLIGHT_KINDS) {
    const { title, filter } = FLIGHT_KINDS[kind];
    const rows = board.filter(filter);
    return (
      <Modal title={title} onClose={onClose} wide>
        <table className="ops-table">
          <thead>
            <tr>
              <th>Flight</th>
              <th>Route</th>
              <th>Aircraft</th>
              <th>STD</th>
              <th>ETD</th>
              <th>Gate</th>
              <th>Pax</th>
              <th>Checked-in</th>
              <th>Boarded</th>
              <th>Bags</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id} onClick={() => { onClose(); navigate(`/flights/${f.id}`); }}>
                <td className="font-semibold">{f.flightNumber}</td>
                <td>{f.origin} → {f.destination}</td>
                <td>{f.aircraft}</td>
                <td>{f.std}</td>
                <td>{f.etd}</td>
                <td>{f.gate}</td>
                <td>{f.passengers}</td>
                <td>{f.checkedIn}</td>
                <td>{f.boarded}</td>
                <td>{f.bags}</td>
                <td><StatusBadge status={f.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-3 text-ops-dim text-[12px]">NO FLIGHTS IN THIS CATEGORY</div>}
      </Modal>
    );
  }

  return <RemoteDetail kind={kind} date={date} onClose={onClose} />;
}

function RemoteDetail({ kind, date, onClose }: { kind: StatKind; date: string; onClose: () => void }) {
  const [rows, setRows] = useState<Record<string, any>[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let path = "";
    switch (kind) {
      case "CHECKED_IN":
      case "BOARDED":
        path = `/reports/passengers?date=${date}`;
        break;
      case "BAGS_CHECKED":
      case "BAGS_LOADED":
        path = `/reports/baggage?date=${date}`;
        break;
      case "EXCESS_REVENUE":
        path = `/reports/excess-baggage-revenue?date=${date}`;
        break;
      case "MEAL_VOUCHERS":
        path = `/reports/meal-vouchers?date=${date}`;
        break;
      case "LOUNGE_PASSES":
        path = `/reports/lounge-usage?date=${date}`;
        break;
    }
    api.get<Record<string, any>[]>(path).then((all) => {
      if (kind === "CHECKED_IN") setRows(all.filter((r) => r.checkedIn));
      else if (kind === "BOARDED") setRows(all.filter((r) => r.boarded));
      else if (kind === "BAGS_LOADED") setRows(all.filter((r) => ["LOADED", "ARRIVED", "CLAIMED"].includes(r.status)));
      else setRows(all);
    });
  }, [kind, date]);

  const config: Record<string, { title: string; columns: { key: string; label: string }[] }> = {
    CHECKED_IN: {
      title: "PASSENGERS CHECKED-IN",
      columns: [
        { key: "pnr", label: "PNR" },
        { key: "passenger", label: "Passenger" },
        { key: "flight", label: "Flight" },
        { key: "seat", label: "Seat" },
      ],
    },
    BOARDED: {
      title: "PASSENGERS BOARDED",
      columns: [
        { key: "pnr", label: "PNR" },
        { key: "passenger", label: "Passenger" },
        { key: "flight", label: "Flight" },
        { key: "seat", label: "Seat" },
      ],
    },
    BAGS_CHECKED: {
      title: "BAGS CHECKED",
      columns: [
        { key: "tagNumber", label: "Tag" },
        { key: "passenger", label: "Passenger" },
        { key: "pnr", label: "PNR" },
        { key: "weightKg", label: "Weight (kg)" },
        { key: "status", label: "Status" },
      ],
    },
    BAGS_LOADED: {
      title: "BAGS LOADED",
      columns: [
        { key: "tagNumber", label: "Tag" },
        { key: "passenger", label: "Passenger" },
        { key: "pnr", label: "PNR" },
        { key: "weightKg", label: "Weight (kg)" },
        { key: "status", label: "Status" },
      ],
    },
    EXCESS_REVENUE: {
      title: "EXCESS BAGGAGE CHARGES",
      columns: [
        { key: "pnr", label: "PNR" },
        { key: "passenger", label: "Passenger" },
        { key: "flight", label: "Flight" },
        { key: "excessKg", label: "Excess (kg)" },
        { key: "totalCharge", label: "Charge" },
        { key: "paymentStatus", label: "Payment" },
      ],
    },
    MEAL_VOUCHERS: {
      title: "MEAL VOUCHERS ISSUED",
      columns: [
        { key: "voucherNo", label: "Voucher No." },
        { key: "passenger", label: "Passenger" },
        { key: "pnr", label: "PNR" },
        { key: "flight", label: "Flight" },
        { key: "mealType", label: "Meal Type" },
        { key: "status", label: "Status" },
      ],
    },
    LOUNGE_PASSES: {
      title: "LOUNGE PASSES ISSUED",
      columns: [
        { key: "passId", label: "Pass ID" },
        { key: "passenger", label: "Passenger" },
        { key: "pnr", label: "PNR" },
        { key: "flight", label: "Flight" },
        { key: "accessType", label: "Access Type" },
        { key: "status", label: "Status" },
      ],
    },
  };

  const { title, columns } = config[kind];
  const badgeCols = new Set(["status", "paymentStatus"]);

  return (
    <Modal title={title} onClose={onClose} wide>
      {!rows && <div className="p-3 text-ops-dim text-[12px]">LOADING...</div>}
      {rows && (
        <table className="ops-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                onClick={() => {
                  if (!r.pnr) return;
                  onClose();
                  navigate(`/checkin?pnr=${r.pnr}`);
                }}
              >
                {columns.map((c) => (
                  <td key={c.key}>
                    {badgeCols.has(c.key) ? (
                      <StatusBadge status={String(r[c.key])} />
                    ) : c.key === "totalCharge" ? (
                      fmtMoney(Number(r[c.key]))
                    ) : (
                      String(r[c.key] ?? "-")
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {rows && rows.length === 0 && <div className="p-3 text-ops-dim text-[12px]">NO RECORDS</div>}
    </Modal>
  );
}
