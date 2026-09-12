// Real-time operational recommendation engine: given a flight's scheduled
// time and current passenger-processing state, suggest the next action an
// ops controller should take right now (open check-in, open boarding, final
// call, depart, mark landed...). Purely advisory — never mutates state.

export interface FlightTimingInput {
  id: string;
  flightNumber: string;
  departureDate: string; // YYYY-MM-DD
  std: string; // HH:mm
  sta: string; // HH:mm
  status: string;
  checkinOpen: boolean;
  boardingOpen: boolean;
  totalPax: number;
  checkedIn: number;
  boarded: number;
}

export interface OpsSuggestion {
  level: "info" | "warn" | "urgent";
  flightId: string;
  flightNumber: string;
  action: string;
  message: string;
  minutesToStd: number;
}

const CHECKIN_OPEN_BEFORE = 180; // open check-in 3h before STD
const CHECKIN_CLOSE_BEFORE = 45; // close check-in 45min before STD
const BOARDING_OPEN_BEFORE = 40; // open boarding 40min before STD
const FINAL_CALL_BEFORE = 15; // final call 15min before STD
const ARRIVAL_SOON_BEFORE = 15; // "prepare arrival gate" 15min before STA

const DONE_STATUSES = ["CANCELLED", "CLOSED", "COMPLETED", "ARRIVED"];

// Bigger loads need a bigger head start on check-in/boarding/final call.
function loadBuffer(totalPax: number): number {
  if (totalPax > 150) return 20;
  if (totalPax > 80) return 10;
  return 0;
}

function toDateTime(dateStr: string, timeStr: string): Date | null {
  const m = timeStr?.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const [y, mo, d] = dateStr.split("-").map(Number);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d, parseInt(m[1], 10), parseInt(m[2], 10), 0);
}

function fmtMinutes(mins: number): string {
  const abs = Math.abs(Math.round(mins));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const core = h > 0 ? `${h}h ${m}m` : `${m}min`;
  return mins >= 0 ? `in ${core}` : `${core} ago`;
}

export function buildFlightSuggestion(f: FlightTimingInput, now: Date): OpsSuggestion | null {
  if (DONE_STATUSES.includes(f.status)) return null;

  const std = toDateTime(f.departureDate, f.std);
  if (!std) return null;
  const minutesToStd = (std.getTime() - now.getTime()) / 60000;
  const buffer = loadBuffer(f.totalPax);

  const base = { flightId: f.id, flightNumber: f.flightNumber, minutesToStd };

  if (f.status === "DEPARTED") {
    const sta = toDateTime(f.departureDate, f.sta);
    if (!sta) return null;
    const minutesToSta = (sta.getTime() - now.getTime()) / 60000;
    // Once departed, the relevant clock is time-to-arrival, not time-to-
    // departure — override the sort key so arrival suggestions interleave
    // correctly with pre-departure ones instead of sorting by a stale STD.
    const arrivalBase = { ...base, minutesToStd: minutesToSta };
    if (minutesToSta <= 0) {
      return { ...arrivalBase, level: "warn", action: "MARK LANDED", message: `${f.flightNumber} — ETA passed ${fmtMinutes(minutesToSta)}, mark landed` };
    }
    if (minutesToSta <= ARRIVAL_SOON_BEFORE) {
      return { ...arrivalBase, level: "info", action: "PREPARE ARRIVAL", message: `${f.flightNumber} — arriving ${fmtMinutes(minutesToSta)}, assign arrival gate` };
    }
    return null;
  }

  // Not yet departed.
  if (minutesToStd <= 0) {
    return {
      ...base,
      level: "urgent",
      action: "DEPART NOW",
      message: `${f.flightNumber} — STD passed ${fmtMinutes(minutesToStd)}, close gate & mark departed`,
    };
  }

  if (minutesToStd <= FINAL_CALL_BEFORE + buffer * 0.5 && f.boardingOpen && f.boarded < f.checkedIn && f.status !== "FINAL CALL") {
    const remaining = f.checkedIn - f.boarded;
    return {
      ...base,
      level: "urgent",
      action: "FINAL CALL",
      message: `${f.flightNumber} — departs ${fmtMinutes(minutesToStd)}, ${remaining} passenger(s) still not boarded`,
    };
  }

  if (minutesToStd <= BOARDING_OPEN_BEFORE + buffer && !f.boardingOpen && f.checkedIn > 0) {
    return {
      ...base,
      level: "warn",
      action: "OPEN BOARDING",
      message: `${f.flightNumber} — departs ${fmtMinutes(minutesToStd)}, open boarding (${f.checkedIn} checked in)`,
    };
  }

  if (minutesToStd <= CHECKIN_CLOSE_BEFORE + buffer * 0.5 && f.checkinOpen) {
    return {
      ...base,
      level: "warn",
      action: "CLOSE CHECK-IN",
      message: `${f.flightNumber} — departs ${fmtMinutes(minutesToStd)}, close check-in and prepare boarding`,
    };
  }

  if (minutesToStd <= CHECKIN_OPEN_BEFORE + buffer && !f.checkinOpen) {
    return {
      ...base,
      level: "info",
      action: "OPEN CHECK-IN",
      message: `${f.flightNumber} — departs ${fmtMinutes(minutesToStd)}, open check-in (${f.totalPax} pax expected)`,
    };
  }

  return null;
}

export function buildOpsSuggestions(flights: FlightTimingInput[], now: Date = new Date()): OpsSuggestion[] {
  return flights
    .map((f) => buildFlightSuggestion(f, now))
    .filter((s): s is OpsSuggestion => s !== null)
    .sort((a, b) => a.minutesToStd - b.minutesToStd);
}
