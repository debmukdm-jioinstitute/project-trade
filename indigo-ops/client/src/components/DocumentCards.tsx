import { QrImage, BarcodeImage } from "./QrBarcode";
import type { Booking, BoardingPass, MealVoucher, LoungePass } from "../lib/api";

const cardBase = "bg-white text-black p-4 w-[420px] font-mono shadow-lg print:shadow-none";

export function BoardingPassCard({ booking, bp }: { booking: Booking; bp: BoardingPass }) {
  return (
    <div className={cardBase}>
      <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2">
        <div className="font-bold text-lg tracking-wide">INDIGO</div>
        <div className="text-xs uppercase">Boarding Pass (Simulation)</div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
        <Field label="Passenger" value={booking.passenger.name.toUpperCase()} />
        <Field label="Flight" value={booking.flight.flightNumber} />
        <Field label="Date" value={booking.flight.departureDate} />
        <Field label="Origin" value={booking.flight.origin} />
        <Field label="Destination" value={booking.flight.destination} />
        <Field label="Seat" value={bp.seatNumber} />
        <Field label="Group" value={bp.boardingGroup} />
        <Field label="Gate" value={bp.gate ?? "TBD"} />
        <Field label="Boarding Time" value={bp.boardingTime ?? "-"} />
        <Field label="Sequence No." value={String(bp.sequenceNumber).padStart(3, "0")} />
        <Field label="Document No." value={bp.documentNo} />
        <Field label="Status" value={bp.status} />
      </div>
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-black">
        <BarcodeImage payload={bp.qrPayload} width={220} height={48} />
        <QrImage payload={bp.qrPayload} size={80} />
      </div>
      <div className="text-[9px] text-center mt-2 text-neutral-500">PROTOTYPE DOCUMENT — NOT VALID FOR TRAVEL</div>
    </div>
  );
}

export function MealVoucherCard({ booking, voucher }: { booking: Booking; voucher: MealVoucher }) {
  return (
    <div className={cardBase}>
      <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2">
        <div className="font-bold text-lg tracking-wide">INDIGO</div>
        <div className="text-xs uppercase">Meal Voucher (Simulation)</div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
        <Field label="Voucher No." value={voucher.voucherNo} />
        <Field label="Passenger" value={booking.passenger.name.toUpperCase()} />
        <Field label="Flight" value={booking.flight.flightNumber} />
        <Field label="Meal Type" value={voucher.mealType} />
        <Field label="Validity" value={voucher.validity} />
        <Field label="Status" value={voucher.status} />
      </div>
      <div className="flex justify-center mt-3 pt-2 border-t border-black">
        <QrImage payload={voucher.qrPayload} size={100} />
      </div>
    </div>
  );
}

export function LoungePassCard({ booking, pass }: { booking: Booking; pass: LoungePass }) {
  return (
    <div className={cardBase}>
      <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2">
        <div className="font-bold text-lg tracking-wide">INDIGO</div>
        <div className="text-xs uppercase">Lounge Pass (Simulation)</div>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
        <Field label="Pass ID" value={pass.passId} />
        <Field label="Passenger" value={booking.passenger.name.toUpperCase()} />
        <Field label="Flight" value={booking.flight.flightNumber} />
        <Field label="Airport" value={pass.airport} />
        <Field label="Terminal" value={pass.terminal} />
        <Field label="Lounge" value={pass.lounge} />
        <Field label="Access Type" value={pass.accessType} />
        <Field label="Validity" value={pass.validity} />
        <Field label="Status" value={pass.status} />
      </div>
      <div className="flex justify-center mt-3 pt-2 border-t border-black">
        <QrImage payload={pass.qrPayload} size={100} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase text-neutral-500">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
