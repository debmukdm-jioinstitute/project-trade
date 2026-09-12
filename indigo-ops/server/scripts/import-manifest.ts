// One-off import: reads MANIFEST 12 SEPT.xlsx (both tabs) and loads it into
// the operational database — flight schedule (all days) + passenger manifest
// / meal (food choice) data for the 12-Sept flights. Run with:
//   npx tsx scripts/import-manifest.ts /path/to/MANIFEST.xlsx
import { randomUUID } from "node:crypto";
import XLSXPkg from "xlsx";
const XLSX: any = XLSXPkg;
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FILE_PATH = process.argv[2] ?? "/Users/debabrata/Downloads/MANIFEST 12 SEPT.xlsx";
const CHUNK = 200;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// Cells are read with raw:false (formatted display text, e.g. "12-Sep-2026",
// "20:00") rather than as Excel serials/Date objects — this workbook's cached
// formula values produced incorrect results when SheetJS's cellDates
// numeric-to-Date conversion was applied (off by ~5.5h and a day), so the
// formatted text — exactly what a person opening the file in Excel would
// see — is used as the source of truth instead.
function parseSheetDate(s: string): string {
  const m = s.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!m) return s.trim();
  const [, d, mon, y] = m;
  const month = MONTHS[mon.toLowerCase()];
  return `${y}-${pad2(month)}-${pad2(parseInt(d, 10))}`;
}

function parseSheetTime(s: string): string {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s.trim();
  return `${pad2(parseInt(m[1], 10))}:${m[2]}`;
}

function findHeaderRow(aoa: any[][], marker: string): { headerIdx: number; col: (name: string, fromIndex?: number) => number } {
  const headerIdx = aoa.findIndex((r) => Array.isArray(r) && r.includes(marker));
  if (headerIdx === -1) throw new Error(`Could not find header row containing "${marker}"`);
  const headerRow = aoa[headerIdx];
  // NOTE: the Passenger Manifest sheet has two side-by-side tables sharing
  // identical column headers (Seat, PNR, Passenger Name, ...) — the left one
  // is a live "currently selected flight" view, the right one (after "Flight
  // Key") is the real master repository. Callers must pass fromIndex to land
  // on the correct occurrence rather than the first (left-block) one.
  return { headerIdx, col: (name: string, fromIndex = 0) => headerRow.indexOf(name, fromIndex) };
}

function mapStatus(raw: string): string {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "departed") return "DEPARTED";
  if (s === "boarding") return "BOARDING";
  if (s === "delayed") return "DELAYED";
  if (s === "on-time" || s === "scheduled") return "SCHEDULED";
  return "SCHEDULED";
}

function mapMealType(raw: string): string | null {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "no meal" || s === "") return null;
  if (s === "veg") return "VEGETARIAN";
  if (s === "non-veg") return "NON_VEGETARIAN";
  if (s === "vegan") return "VEGAN";
  if (s === "jain") return "JAIN";
  return raw.toUpperCase();
}

async function chunked<T>(items: T[], fn: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < items.length; i += CHUNK) {
    await fn(items.slice(i, i + CHUNK));
    process.stdout.write(`\r  ${Math.min(i + CHUNK, items.length)}/${items.length}`);
  }
  process.stdout.write("\n");
}

async function main() {
  console.log(`Reading ${FILE_PATH} ...`);
  const wb = XLSX.readFile(FILE_PATH, { cellDates: false });

  const schedSheet = wb.Sheets["IndiGo Flight Schedule"];
  const repoSheet = wb.Sheets["Passenger Manifest"];
  if (!schedSheet || !repoSheet) {
    throw new Error(`Expected sheets "IndiGo Flight Schedule" and "Passenger Manifest", found: ${wb.SheetNames.join(", ")}`);
  }

  const schedAOA: any[][] = XLSX.utils.sheet_to_json(schedSheet, { header: 1, raw: false, defval: null });
  const repoAOA: any[][] = XLSX.utils.sheet_to_json(repoSheet, { header: 1, raw: false, defval: null });

  // ---- Aircraft pool (reuse existing where the type already matches) ----
  const existingAircraft = await prisma.aircraft.findMany();
  const aircraftByType = new Map<string, string>(); // type -> aircraftId
  for (const a of existingAircraft) if (!aircraftByType.has(a.type)) aircraftByType.set(a.type, a.id);

  const NEW_AIRCRAFT: { type: string; registration: string; configuration: string; seatCapacity: number }[] = [
    { type: "ATR 72-600", registration: "VT-IFR1", configuration: "78Y", seatCapacity: 78 },
    { type: "B777-300ER", registration: "VT-IFW1", configuration: "396Y", seatCapacity: 396 },
  ];
  for (const na of NEW_AIRCRAFT) {
    if (aircraftByType.has(na.type)) continue;
    const created = await prisma.aircraft.upsert({
      where: { registration: na.registration },
      update: {},
      create: { registration: na.registration, type: na.type, configuration: na.configuration, seatCapacity: na.seatCapacity, status: "ACTIVE" },
    });
    aircraftByType.set(na.type, created.id);
  }
  console.log("Aircraft pool:", [...aircraftByType.entries()]);

  // ---- Flight schedule (all days) ----
  const sched = findHeaderRow(schedAOA, "Flight Number");
  const sCol = {
    num: sched.col("Flight Number"),
    sector: sched.col("Sector"),
    date: sched.col("Date"),
    dep: sched.col("Departure Time"),
    arr: sched.col("Arrival Time"),
    aircraft: sched.col("Aircraft Type"),
    sectorType: sched.col("Sector Type"),
    terminal: sched.col("Terminal"),
    status: sched.col("Status"),
  };
  const scheduleDataRows = schedAOA.slice(sched.headerIdx + 1).filter((r) => r && r[sCol.num]);
  console.log(`Schedule rows: ${scheduleDataRows.length}`);

  const flightIdByKey = new Map<string, string>(); // "FLIGHTNUM|YYYY-MM-DD|STD" -> flightId
  const sept12FlightIdByNumber = new Map<string, string>(); // flightNumber -> flightId (12-Sep is 1 departure/number)
  const flightInserts: any[] = [];

  for (const r of scheduleDataRows) {
    const flightNumber = String(r[sCol.num]).trim().replace(/\s+/g, "").toUpperCase();
    const sector = String(r[sCol.sector] ?? "");
    const [origin, destination] = sector.split("-").map((s) => s.trim().toUpperCase());
    const departureDate = parseSheetDate(String(r[sCol.date] ?? ""));
    const std = parseSheetTime(String(r[sCol.dep] ?? ""));
    const sta = parseSheetTime(String(r[sCol.arr] ?? ""));
    const aircraftType = String(r[sCol.aircraft] ?? "");
    const sectorType = String(r[sCol.sectorType] ?? "");
    const terminal = String(r[sCol.terminal] ?? "T2");
    const status = mapStatus(String(r[sCol.status] ?? ""));

    const key = `${flightNumber}|${departureDate}|${std}`;
    if (flightIdByKey.has(key)) continue; // guard against any accidental dupes
    const id = randomUUID();
    flightIdByKey.set(key, id);
    if (departureDate === "2026-09-12") sept12FlightIdByNumber.set(flightNumber, id);

    flightInserts.push({
      id,
      flightNumber,
      origin: origin ?? "UNK",
      destination: destination ?? "UNK",
      departureDate,
      std,
      etd: std,
      sta,
      eta: sta,
      aircraftId: aircraftByType ? aircraftByType.get(aircraftType) ?? null : null,
      gateId: null,
      terminal,
      sectorType,
      status,
      checkinOpen: status === "BOARDING" || status === "DEPARTED",
      boardingOpen: status === "BOARDING",
    });
  }

  console.log(`Inserting ${flightInserts.length} flights...`);
  await chunked(flightInserts, (batch) => prisma.flight.createMany({ data: batch }));

  // ---- Passenger manifest / meal (food choice) — master repository ----
  const repo = findHeaderRow(repoAOA, "Flight Key");
  const flightKeyIdx = repo.col("Flight Key");
  const rCol = {
    flightKey: flightKeyIdx,
    seat: repo.col("Seat", flightKeyIdx),
    name: repo.col("Passenger Name", flightKeyIdx),
    pnr: repo.col("PNR", flightKeyIdx),
    mealPref: repo.col("Meal Preference", flightKeyIdx),
    mealType: repo.col("Meal Type", flightKeyIdx),
    specialRequest: repo.col("Special Request", flightKeyIdx),
    boardingGroup: repo.col("Boarding Group", flightKeyIdx),
  };
  const repoDataRows = repoAOA.slice(repo.headerIdx + 1).filter((r) => r && r[rCol.flightKey]);
  console.log(`Passenger repository rows: ${repoDataRows.length}`);

  // The sheet's PNRs collide ~112 times across 8640 rows (generator reused a
  // small pool). The existing PNR space turns out to be dense/structured
  // (sequential-looking suffixes), so a narrow last-character substitution
  // still collides with genuine, different PNRs. Fall back to a random 4-char
  // suffix drawn from a large alphabet instead, retrying until free.
  const usedPnrs = new Set<string>();
  const PNR_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function dedupePnr(base: string): string {
    if (!usedPnrs.has(base)) {
      usedPnrs.add(base);
      return base;
    }
    for (let attempt = 0; attempt < 50; attempt++) {
      let candidate = "6E";
      for (let i = 0; i < 4; i++) candidate += PNR_ALPHABET[Math.floor(Math.random() * PNR_ALPHABET.length)];
      if (!usedPnrs.has(candidate)) {
        usedPnrs.add(candidate);
        return candidate;
      }
    }
    const fallback = "6E" + randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
    usedPnrs.add(fallback);
    return fallback;
  }

  const passengerInserts: any[] = [];
  const bookingInserts: any[] = [];
  const seatInserts: any[] = [];
  const voucherInserts: any[] = [];
  let voucherSeq = 0;
  let skippedNoFlight = 0;

  // The manifest is for 12-Sept-2026 specifically (see sheet header) — that
  // day has exactly one departure per flight number, so it's looked up by
  // number alone rather than the full number+date+time key.
  const MANIFEST_DATE = "2026-09-12";

  for (const r of repoDataRows) {
    const flightKey = String(r[rCol.flightKey]).trim().replace(/\s+/g, "").toUpperCase();
    const flightId = sept12FlightIdByNumber.get(flightKey);
    if (!flightId) {
      skippedNoFlight++;
      continue;
    }

    const seatNumber = String(r[rCol.seat] ?? "");
    const name = String(r[rCol.name] ?? "Unknown Passenger");
    const pnr = dedupePnr(String(r[rCol.pnr] ?? "").trim().toUpperCase());
    const mealPreference = r[rCol.mealPref] != null ? String(r[rCol.mealPref]) : null; // dish name
    const mealTypeMapped = mapMealType(String(r[rCol.mealType] ?? ""));
    const specialRequest = r[rCol.specialRequest] != null ? String(r[rCol.specialRequest]) : null;
    const boardingGroup = String(r[rCol.boardingGroup] ?? "Zone 1");

    const passengerId = randomUUID();
    const bookingId = randomUUID();
    const seatId = randomUUID();

    passengerInserts.push({ id: passengerId, name });

    const rowNum = parseInt(seatNumber, 10) || 99;
    bookingInserts.push({
      id: bookingId,
      pnr,
      passengerId,
      flightId,
      fareType: "SAVER",
      status: "CONFIRMED",
      boardingGroup,
      mealSelection: mealTypeMapped,
    });

    seatInserts.push({
      id: seatId,
      flightId,
      seatNumber,
      cabin: rowNum <= 2 ? "BUSINESS" : "ECONOMY",
      status: "BOOKED",
      bookingId,
    });

    if (mealTypeMapped) {
      voucherSeq++;
      const voucherNo = `MVI${String(voucherSeq).padStart(5, "0")}`;
      voucherInserts.push({
        id: randomUUID(),
        voucherNo,
        bookingId,
        flightId,
        mealType: mealTypeMapped,
        mealItem: mealPreference,
        specialRequest,
        validity: MANIFEST_DATE,
        status: "ISSUED",
        qrPayload: `6E|MV|${pnr}|${voucherNo}`,
      });
    }
  }

  if (skippedNoFlight > 0) {
    console.log(`WARNING: ${skippedNoFlight} passenger row(s) had no matching flight and were skipped.`);
  }

  console.log(`Inserting ${passengerInserts.length} passengers...`);
  await chunked(passengerInserts, (batch) => prisma.passenger.createMany({ data: batch }));

  console.log(`Inserting ${bookingInserts.length} bookings...`);
  await chunked(bookingInserts, (batch) => prisma.booking.createMany({ data: batch }));

  console.log(`Inserting ${seatInserts.length} seats...`);
  await chunked(seatInserts, (batch) => prisma.seat.createMany({ data: batch }));

  console.log(`Inserting ${voucherInserts.length} meal vouchers...`);
  await chunked(voucherInserts, (batch) => prisma.mealVoucher.createMany({ data: batch }));

  await prisma.auditLog.create({
    data: {
      category: "SYSTEM",
      message: `IMPORTED MANIFEST 12 SEPT.XLSX — ${flightInserts.length} FLIGHTS, ${bookingInserts.length} BOOKINGS, ${voucherInserts.length} MEAL VOUCHERS`,
    },
  });

  console.log("Import complete.");
  console.log({
    flights: flightInserts.length,
    passengers: passengerInserts.length,
    bookings: bookingInserts.length,
    seats: seatInserts.length,
    mealVouchers: voucherInserts.length,
    dedupedPnrs: usedPnrs.size,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
