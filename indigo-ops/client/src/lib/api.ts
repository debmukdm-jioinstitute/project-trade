export class ApiError extends Error {
  code?: string;
  title?: string;
  constructor(message: string, code?: string, title?: string) {
    super(message);
    this.code = code;
    this.title = title;
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : await res.text();
  if (!res.ok) {
    const err = body?.error;
    throw new ApiError(err?.message ?? "Request failed", err?.code, err?.title);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PATCH", body: data !== undefined ? JSON.stringify(data) : undefined }),
};

// ---- Domain types (subset, matching Prisma models) ----

export interface Aircraft {
  id: string;
  registration: string;
  type: string;
  configuration: string;
  seatCapacity: number;
  status: string;
}

export interface Gate {
  id: string;
  code: string;
  terminal: string;
  status: string;
}

export interface FlightRow {
  id: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureDate: string;
  std: string;
  etd: string | null;
  sta: string;
  eta: string | null;
  aircraft: Aircraft | null;
  gate: Gate | null;
  terminal: string;
  status: string;
  delayMinutes: number;
  checkinOpen: boolean;
  boardingOpen: boolean;
  passengerCount: number;
  checkedInCount: number;
  boardedCount: number;
  bagCount: number;
}

export interface Passenger {
  id: string;
  name: string;
  dob: string | null;
  gender: string | null;
  mobile: string | null;
  email: string | null;
  passportNo: string | null;
}

export interface Seat {
  id: string;
  seatNumber: string;
  cabin: string;
  status: string;
  bookingId: string | null;
}

export interface Baggage {
  id: string;
  tagNumber: string;
  weightKg: number;
  bagType: string;
  destination: string;
  status: string;
}

export interface BaggageCharge {
  id: string;
  allowanceKg: number;
  actualKg: number;
  excessKg: number;
  ratePerKg: number;
  totalCharge: number;
  paymentStatus: string;
  transactionId: string | null;
}

export interface MealVoucher {
  id: string;
  voucherNo: string;
  mealType: string;
  status: string;
  validity: string;
  qrPayload: string;
}

export interface LoungePass {
  id: string;
  passId: string;
  accessType: string;
  status: string;
  airport: string;
  terminal: string;
  lounge: string;
  validity: string;
  qrPayload: string;
}

export interface BoardingPass {
  id: string;
  documentNo: string;
  seatNumber: string;
  boardingGroup: string;
  sequenceNumber: number;
  gate: string | null;
  boardingTime: string | null;
  status: string;
  qrPayload: string;
  createdAt: string;
}

export interface SpecialService {
  id: string;
  serviceType: string;
  notes: string | null;
}

export interface Booking {
  id: string;
  pnr: string;
  status: string;
  fareType: string;
  baggageAllowanceKg: number;
  mealSelection: string | null;
  specialAssistance: string | null;
  paymentStatus: string;
  checkedIn: boolean;
  boarded: boolean;
  noShow: boolean;
  offloaded: boolean;
  deplaned: boolean;
  boardingGroup: string;
  sequenceNumber: number | null;
  passenger: Passenger;
  flight: FlightRow;
  seat: Seat | null;
  baggage: Baggage[];
  baggageCharges: BaggageCharge[];
  mealVouchers: MealVoucher[];
  loungePasses: LoungePass[];
  boardingPasses: BoardingPass[];
  specialServices: SpecialService[];
  transfer?: { outboundFlight: FlightRow; inboundFlight: FlightRow; connectionMinutes: number } | null;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  category: string;
  reference: string | null;
  message: string;
}

export interface DashboardData {
  date: string;
  stats: {
    flightsScheduled: number;
    flightsBoarding: number;
    flightsDeparted: number;
    flightsArrived: number;
    delayed: number;
    cancelled: number;
    paxCheckedIn: number;
    paxBoarded: number;
    bagsChecked: number;
    bagsLoaded: number;
    excessRevenue: number;
    mealVouchers: number;
    loungePasses: number;
  };
  board: {
    id: string;
    flightNumber: string;
    origin: string;
    destination: string;
    aircraft: string;
    registration: string;
    std: string;
    etd: string | null;
    gate: string;
    terminal: string;
    passengers: number;
    checkedIn: number;
    boarded: number;
    bags: number;
    status: string;
  }[];
  alerts: { level: "warn" | "ok"; message: string }[];
  suggestions: {
    level: "info" | "warn" | "urgent";
    flightId: string;
    flightNumber: string;
    action: string;
    message: string;
    minutesToStd: number;
  }[];
}

export interface FlightManifest {
  flight: {
    flightNumber: string;
    origin: string;
    destination: string;
    departureDate: string;
    std: string;
    etd: string | null;
    sta: string;
    eta: string | null;
    status: string;
    terminal: string;
    crew: string;
    delayMinutes: number;
    aircraft: { registration: string; type: string; configuration: string; seatCapacity: number } | null;
    gate: { code: string; terminal: string } | null;
  };
  checkpoints: {
    totalPax: number;
    checkedIn: number;
    bagDrop: number;
    securityCleared: number;
    loungeUsed: number;
    boarded: number;
    noShow: number;
    offloaded: number;
    deplaned: number;
    bagsTotal: number;
    bagsLoaded: number;
    excessBaggageRevenue: number;
  };
  passengers: {
    pnr: string;
    name: string;
    mobile: string | null;
    email: string | null;
    seat: string | null;
    fareType: string;
    checkedIn: boolean;
    bagDrop: boolean;
    securityCleared: boolean;
    loungeUsed: boolean;
    boarded: boolean;
    noShow: boolean;
    offloaded: boolean;
    deplaned: boolean;
    boardingPass: boolean;
    specialServices: string[];
  }[];
  baggage: {
    tagNumber: string;
    pnr: string;
    passenger: string;
    weightKg: number;
    bagType: string;
    destination: string;
    status: string;
  }[];
  excessCharges: {
    pnr: string;
    passenger: string;
    excessKg: number;
    ratePerKg: number;
    totalCharge: number;
    paymentStatus: string;
  }[];
  mealVouchers: {
    voucherNo: string;
    pnr: string;
    passenger: string;
    mealType: string;
    mealItem: string | null;
    specialRequest: string | null;
    status: string;
  }[];
  loungePasses: { passId: string; pnr: string; passenger: string; lounge: string; accessType: string; status: string }[];
  generatedAt: string;
}
