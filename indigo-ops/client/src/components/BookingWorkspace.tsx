import { useEffect, useState, type ReactNode } from "react";
import { api, Booking } from "../lib/api";
import { StatusBadge } from "./StatusBadge";
import { PassengerTimeline } from "./PassengerTimeline";
import { Modal } from "./Modal";
import { useToast } from "./Toast";
import { BoardingPassCard, MealVoucherCard, LoungePassCard } from "./DocumentCards";
import { fmtMoney } from "../lib/status";

// Full read/act passenger detail card: identity, timeline, seat, baggage +
// excess charge, vouchers, lounge, boarding pass, documents. Shared by the
// Check-in / PNR workspace and the global customer search on the dashboard.
export function BookingWorkspace({
  booking,
  timeline,
  connectionAlert,
  onChange,
}: {
  booking: Booking;
  timeline: { step: string; reached: boolean }[];
  connectionAlert: string | null;
  onChange: () => void;
}) {
  const toast = useToast();
  const [seatMap, setSeatMap] = useState<{ seatNumber: string; status: string }[]>([]);
  const [weightKg, setWeightKg] = useState("15");

  useEffect(() => {
    api.get<{ seatNumber: string; status: string }[]>(`/flights/${booking.flight.id}/seatmap`).then(setSeatMap);
  }, [booking.flight.id]);

  async function run(fn: () => Promise<unknown>, okTitle: string) {
    try {
      await fn();
      toast.push({ kind: "success", title: okTitle });
      onChange();
    } catch (e) {
      toast.push({ kind: "error", title: (e as any).title ?? "ACTION FAILED", message: (e as Error).message });
    }
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="col-span-2 space-y-3">
        <div className="panel p-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-lg font-semibold">{booking.passenger.name}</div>
              <div className="text-ops-dim text-[11px]">
                PNR {booking.pnr} &nbsp; {booking.flight.flightNumber} {booking.flight.origin}→{booking.flight.destination} &nbsp;
                SEAT {booking.seat?.seatNumber ?? "UNASSIGNED"}
              </div>
              <div className="text-ops-dim text-[11px]">
                {booking.passenger.mobile ?? "NO MOBILE"} &nbsp; {booking.passenger.email ?? "NO EMAIL"}
              </div>
            </div>
            <div className="flex gap-1">
              <StatusBadge status={booking.checkedIn ? "CHECKED-IN" : "NOT CHECKED-IN"} />
              <StatusBadge status={booking.boarded ? "BOARDED" : booking.status} />
            </div>
          </div>
          <PassengerTimeline timeline={timeline} />
          {connectionAlert && <div className="mt-2 text-ops-amber text-[12px]">⚠ {connectionAlert}</div>}
          {booking.specialServices.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {booking.specialServices.map((s) => (
                <span key={s.id} className="badge badge-cyan">
                  {s.serviceType.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {!booking.checkedIn ? (
              <button className="btn-primary btn" onClick={() => run(() => api.post(`/bookings/${booking.id}/checkin`), "CHECKED IN")}>
                CHECK-IN
              </button>
            ) : (
              <span className="badge badge-green">CHECK-IN COMPLETE</span>
            )}
            {!booking.boardingPasses.some((b) => b.status === "VALID") && booking.checkedIn && (
              <button className="btn" onClick={() => run(() => api.post(`/bookings/${booking.id}/boarding-pass`), "BOARDING PASS GENERATED")}>
                GENERATE BOARDING PASS
              </button>
            )}
            <button className="btn-danger btn" onClick={() => run(() => api.post(`/bookings/${booking.id}/cancel`), "BOOKING CANCELLED")}>
              CANCEL BOOKING
            </button>
          </div>
        </div>

        <div className="panel p-3">
          <div className="text-[11px] text-ops-dim uppercase mb-2">Seat</div>
          <div className="flex gap-2 flex-wrap max-h-28 overflow-y-auto">
            {seatMap.map((s) => (
              <button
                key={s.seatNumber}
                disabled={s.status === "BOOKED" || s.status === "CHECKED-IN"}
                onClick={() => run(() => api.post(`/bookings/${booking.id}/seat`, { seatNumber: s.seatNumber }), `SEAT ${s.seatNumber} ASSIGNED`)}
                className={`btn ${booking.seat?.seatNumber === s.seatNumber ? "btn-primary" : ""}`}
              >
                {s.seatNumber}
              </button>
            ))}
          </div>
        </div>

        <div className="panel p-3">
          <div className="text-[11px] text-ops-dim uppercase mb-2">Baggage — Allowance {booking.baggageAllowanceKg} KG</div>
          <table className="ops-table mb-2">
            <thead>
              <tr>
                <th>Tag</th>
                <th>Weight</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {booking.baggage.map((b) => (
                <tr key={b.id}>
                  <td>{b.tagNumber}</td>
                  <td>{b.weightKg} KG</td>
                  <td><StatusBadge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-2 items-center">
            <input className="input w-24" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="KG" />
            <button className="btn" onClick={() => run(() => api.post(`/bookings/${booking.id}/baggage`, { weightKg: Number(weightKg) }), "BAGGAGE ACCEPTED")}>
              ADD BAGGAGE
            </button>
          </div>

          {booking.baggageCharges.map((c) => (
            <div key={c.id} className="mt-3 border border-ops-border2 p-2 text-[12px] space-y-1">
              <div className="grid grid-cols-2 gap-1">
                <span className="text-ops-dim">BASE ALLOWANCE</span><span>{c.allowanceKg} KG</span>
                <span className="text-ops-dim">ACTUAL WEIGHT</span><span>{c.actualKg} KG</span>
                <span className="text-ops-dim">EXCESS WEIGHT</span><span className="text-ops-amber">{c.excessKg} KG</span>
                <span className="text-ops-dim">RATE/KG</span><span>{fmtMoney(c.ratePerKg)}</span>
                <span className="text-ops-dim">TOTAL CHARGE</span><span className="text-ops-red font-semibold">{fmtMoney(c.totalCharge)}</span>
                <span className="text-ops-dim">PAYMENT STATUS</span><span><StatusBadge status={c.paymentStatus} /></span>
              </div>
              {c.paymentStatus === "PENDING" && (
                <button className="btn-primary btn" onClick={() => run(() => api.post(`/baggage/charges/${c.id}/pay`), "EXCESS BAGGAGE PAID")}>
                  MARK PAID / GENERATE RECEIPT
                </button>
              )}
              {c.transactionId && <div className="text-ops-dim text-[10px]">TXN: {c.transactionId}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <VoucherLoungePanel booking={booking} run={run} />
        <DocumentsPanel booking={booking} />
      </div>
    </div>
  );
}

function VoucherLoungePanel({ booking, run }: { booking: Booking; run: (fn: () => Promise<unknown>, okTitle: string) => void }) {
  return (
    <div className="panel p-3 space-y-3">
      <div>
        <div className="text-[11px] text-ops-dim uppercase mb-2">Meal Vouchers</div>
        {booking.mealVouchers.map((v) => (
          <div key={v.id} className="flex items-center justify-between text-[12px] mb-1">
            <span>{v.voucherNo} — {v.mealType}</span>
            <div className="flex gap-1 items-center">
              <StatusBadge status={v.status} />
              {v.status === "ISSUED" && (
                <button className="btn" onClick={() => run(() => api.post(`/vouchers/${v.id}/redeem`), "VOUCHER REDEEMED")}>
                  REDEEM
                </button>
              )}
            </div>
          </div>
        ))}
        <div className="flex gap-1 mt-1 flex-wrap">
          {["STANDARD", "VEGETARIAN", "NON_VEGETARIAN", "SNACK"].map((m) => (
            <button key={m} className="btn" onClick={() => run(() => api.post(`/bookings/${booking.id}/meal-voucher`, { mealType: m }), "MEAL VOUCHER ISSUED")}>
              + {m}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[11px] text-ops-dim uppercase mb-2">Lounge Passes</div>
        {booking.loungePasses.map((l) => (
          <div key={l.id} className="flex items-center justify-between text-[12px] mb-1">
            <span>{l.passId} — {l.accessType}</span>
            <div className="flex gap-1 items-center">
              <StatusBadge status={l.status} />
              {l.status === "ISSUED" && (
                <button className="btn" onClick={() => run(() => api.post(`/lounge/${l.id}/use`), "LOUNGE PASS USED")}>
                  USE
                </button>
              )}
            </div>
          </div>
        ))}
        <button className="btn mt-1" onClick={() => run(() => api.post(`/bookings/${booking.id}/lounge-pass`, {}), "LOUNGE PASS ISSUED")}>
          + ISSUE LOUNGE PASS
        </button>
      </div>
      <div>
        <div className="text-[11px] text-ops-dim uppercase mb-2">Special Services</div>
        <div className="flex gap-1 flex-wrap">
          {["WHEELCHAIR", "UNACCOMPANIED_MINOR", "SPECIAL_MEAL", "INFANT", "MEDICAL", "PRIORITY_BOARDING", "EXTRA_BAGGAGE", "SPORTS_EQUIPMENT"].map((s) => (
            <button key={s} className="btn" onClick={() => run(() => api.post(`/bookings/${booking.id}/special-service`, { serviceType: s }), "SPECIAL SERVICE ADDED")}>
              + {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DocumentsPanel({ booking }: { booking: Booking }) {
  const [preview, setPreview] = useState<ReactNode>(null);
  const validBp = booking.boardingPasses.find((b) => b.status === "VALID");
  return (
    <div className="panel p-3 space-y-2">
      <div className="text-[11px] text-ops-dim uppercase mb-1">Documents</div>
      {validBp && (
        <button className="btn w-full" onClick={() => setPreview(<BoardingPassCard booking={booking} bp={validBp} />)}>
          VIEW BOARDING PASS
        </button>
      )}
      {booking.mealVouchers[0] && (
        <button className="btn w-full" onClick={() => setPreview(<MealVoucherCard booking={booking} voucher={booking.mealVouchers[0]} />)}>
          VIEW MEAL VOUCHER
        </button>
      )}
      {booking.loungePasses[0] && (
        <button className="btn w-full" onClick={() => setPreview(<LoungePassCard booking={booking} pass={booking.loungePasses[0]} />)}>
          VIEW LOUNGE PASS
        </button>
      )}
      {preview && (
        <Modal title="DOCUMENT PREVIEW" onClose={() => setPreview(null)}>
          <div className="flex justify-center print-area">{preview}</div>
          <button className="btn w-full mt-3" onClick={() => window.print()}>
            PRINT
          </button>
        </Modal>
      )}
    </div>
  );
}
