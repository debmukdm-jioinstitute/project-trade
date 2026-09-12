import { prisma } from "../lib/prisma.js";
import { audit } from "../lib/audit.js";
import { OpsError } from "../lib/errors.js";

const SEAT_COLS = ["A", "B", "C", "D", "E", "F"];

export async function generateSeatMap(flightId: string, capacity: number) {
  const rows = Math.ceil(capacity / SEAT_COLS.length);
  const seats: { flightId: string; seatNumber: string; cabin: string }[] = [];
  let made = 0;
  for (let r = 1; r <= rows && made < capacity; r++) {
    for (const c of SEAT_COLS) {
      if (made >= capacity) break;
      seats.push({ flightId, seatNumber: `${r}${c}`, cabin: r <= 2 ? "BUSINESS" : "ECONOMY" });
      made++;
    }
  }
  await prisma.seat.createMany({ data: seats });
}

export async function createFlight(input: {
  flightNumber: string;
  origin: string;
  destination: string;
  departureDate: string;
  std: string;
  sta: string;
  aircraftId?: string;
  gateId?: string;
  terminal?: string;
}) {
  if (input.origin === input.destination) {
    throw new OpsError("OPS-101", "INVALID ROUTE", "Origin and destination cannot be the same.");
  }
  const flight = await prisma.flight.create({
    data: {
      flightNumber: input.flightNumber.toUpperCase(),
      origin: input.origin.toUpperCase(),
      destination: input.destination.toUpperCase(),
      departureDate: input.departureDate,
      std: input.std,
      etd: input.std,
      sta: input.sta,
      eta: input.sta,
      aircraftId: input.aircraftId ?? null,
      gateId: input.gateId ?? null,
      terminal: input.terminal ?? "T2",
      status: "SCHEDULED",
    },
  });

  if (input.aircraftId) {
    const aircraft = await prisma.aircraft.findUnique({ where: { id: input.aircraftId } });
    if (aircraft) await generateSeatMap(flight.id, aircraft.seatCapacity);
  }

  await audit("FLIGHT", `FLIGHT ${flight.flightNumber} CREATED ${flight.origin}->${flight.destination}`, flight.flightNumber);
  return flight;
}

export async function assignAircraft(flightId: string, aircraftId: string) {
  const flight = await prisma.flight.findUniqueOrThrow({ where: { id: flightId } });
  const aircraft = await prisma.aircraft.findUniqueOrThrow({ where: { id: aircraftId } });

  const existingSeats = await prisma.seat.count({ where: { flightId } });
  if (existingSeats === 0) {
    await generateSeatMap(flightId, aircraft.seatCapacity);
  }

  const updated = await prisma.flight.update({ where: { id: flightId }, data: { aircraftId } });
  await audit("FLIGHT", `AIRCRAFT ${aircraft.registration} ASSIGNED TO ${flight.flightNumber}`, flight.flightNumber);
  return updated;
}

export async function assignGate(flightId: string, gateId: string) {
  const flight = await prisma.flight.findUniqueOrThrow({ where: { id: flightId } });
  const gate = await prisma.gate.findUniqueOrThrow({ where: { id: gateId } });

  const conflict = await prisma.flight.findFirst({
    where: {
      gateId,
      id: { not: flightId },
      departureDate: flight.departureDate,
      status: { in: ["SCHEDULED", "CHECK-IN OPEN", "CHECK-IN CLOSED", "BOARDING", "FINAL CALL"] },
    },
  });
  if (conflict) {
    throw new OpsError(
      "GATE-301",
      "GATE CONFLICT",
      `Gate ${gate.code} is already assigned to active flight ${conflict.flightNumber}.`
    );
  }

  await prisma.flight.update({ where: { id: flightId }, data: { gateId } });
  await prisma.gate.update({ where: { id: gateId }, data: { status: "ASSIGNED" } });
  await audit("GATE", `GATE ${gate.code} ASSIGNED TO ${flight.flightNumber}`, flight.flightNumber);
  return prisma.flight.findUnique({ where: { id: flightId }, include: { gate: true } });
}

export async function changeGate(flightId: string, gateId: string) {
  const flight = await prisma.flight.findUniqueOrThrow({ where: { id: flightId } });
  if (flight.gateId) {
    await prisma.gate.update({ where: { id: flight.gateId }, data: { status: "AVAILABLE" } }).catch(() => {});
  }
  return assignGate(flightId, gateId);
}

export async function delayFlight(flightId: string, minutes: number, newEtd?: string) {
  const flight = await prisma.flight.findUniqueOrThrow({ where: { id: flightId } });
  const updated = await prisma.flight.update({
    where: { id: flightId },
    data: { status: "DELAYED", delayMinutes: flight.delayMinutes + minutes, etd: newEtd ?? flight.etd },
  });
  await audit("FLIGHT", `FLIGHT ${flight.flightNumber} DELAYED ${minutes} MIN`, flight.flightNumber);
  return updated;
}

export async function cancelFlight(flightId: string) {
  const flight = await prisma.flight.findUniqueOrThrow({ where: { id: flightId } });
  const updated = await prisma.flight.update({ where: { id: flightId }, data: { status: "CANCELLED" } });
  await audit("FLIGHT", `FLIGHT ${flight.flightNumber} CANCELLED`, flight.flightNumber);
  return updated;
}

export async function openCheckin(flightId: string) {
  const flight = await prisma.flight.findUniqueOrThrow({ where: { id: flightId } });
  const updated = await prisma.flight.update({
    where: { id: flightId },
    data: { checkinOpen: true, status: "CHECK-IN OPEN" },
  });
  await audit("FLIGHT", `CHECK-IN OPENED FOR ${flight.flightNumber}`, flight.flightNumber);
  return updated;
}

export async function closeCheckin(flightId: string) {
  const flight = await prisma.flight.findUniqueOrThrow({ where: { id: flightId } });
  const updated = await prisma.flight.update({
    where: { id: flightId },
    data: { checkinOpen: false, status: "CHECK-IN CLOSED" },
  });
  await audit("FLIGHT", `CHECK-IN CLOSED FOR ${flight.flightNumber}`, flight.flightNumber);
  return updated;
}

export async function openBoarding(flightId: string) {
  const flight = await prisma.flight.findUniqueOrThrow({ where: { id: flightId } });
  const updated = await prisma.flight.update({
    where: { id: flightId },
    data: { boardingOpen: true, status: "BOARDING" },
  });
  await audit("BOARDING", `BOARDING OPENED FOR ${flight.flightNumber}`, flight.flightNumber);
  return updated;
}

export async function finalCall(flightId: string) {
  const flight = await prisma.flight.findUniqueOrThrow({ where: { id: flightId } });
  const updated = await prisma.flight.update({ where: { id: flightId }, data: { status: "FINAL CALL" } });
  await audit("BOARDING", `FINAL CALL — ${flight.flightNumber}`, flight.flightNumber);
  return updated;
}

export async function closeGate(flightId: string) {
  const flight = await prisma.flight.findUniqueOrThrow({ where: { id: flightId }, include: { gate: true } });
  const updated = await prisma.flight.update({
    where: { id: flightId },
    data: { boardingOpen: false, status: "GATE CLOSED" },
  });
  if (flight.gateId) {
    await prisma.gate.update({ where: { id: flight.gateId }, data: { status: "CLOSED" } });
  }
  await audit("GATE", `GATE CLOSED — ${flight.flightNumber}`, flight.flightNumber);
  return updated;
}

export async function departureChecklist(flightId: string) {
  const flight = await prisma.flight.findUniqueOrThrow({
    where: { id: flightId },
    include: { bookings: { include: { baggage: true } } },
  });

  const activeBookings = flight.bookings.filter((b) => b.status !== "CANCELLED");
  const checkedIn = activeBookings.filter((b) => b.checkedIn);
  const unresolved = checkedIn.filter((b) => !b.boarded && !b.noShow && !b.offloaded);
  const notBoardedButLoaded = checkedIn.filter(
    (b) => !b.boarded && b.baggage.some((bag) => bag.status === "LOADED")
  );

  const checklist = {
    aircraftAssigned: !!flight.aircraftId,
    gateClosed: flight.status === "GATE CLOSED",
    boardingCompleted: checkedIn.length > 0 && unresolved.length === 0,
    passengerReconciliation: notBoardedButLoaded.length === 0,
    baggageReconciliation: notBoardedButLoaded.length === 0,
    finalLoad: true,
  };
  const ready = Object.values(checklist).every(Boolean);
  return { checklist, ready, mismatches: notBoardedButLoaded.map((b) => b.id) };
}

export async function markDeparted(flightId: string) {
  const { ready, checklist } = await departureChecklist(flightId);
  if (!ready) {
    throw new OpsError(
      "OPS-104",
      "DEPARTURE DENIED",
      `Departure checklist incomplete: ${Object.entries(checklist)
        .filter(([, v]) => !v)
        .map(([k]) => k)
        .join(", ")}`
    );
  }
  const flight = await prisma.flight.findUniqueOrThrow({ where: { id: flightId } });
  const updated = await prisma.flight.update({
    where: { id: flightId },
    data: { status: "DEPARTED", departedAt: new Date() },
  });
  await prisma.flightOperation.create({ data: { flightId, event: "DEPARTED" } });
  await audit("DEPARTURE", `FLIGHT ${flight.flightNumber} DEPARTED`, flight.flightNumber);
  return updated;
}

export async function markLanded(flightId: string) {
  const flight = await prisma.flight.findUniqueOrThrow({ where: { id: flightId } });
  if (flight.status !== "DEPARTED") {
    throw new OpsError("OPS-108", "CANNOT MARK LANDED", "Flight has not departed yet.");
  }
  const updated = await prisma.flight.update({
    where: { id: flightId },
    data: { status: "LANDED", landedAt: new Date() },
  });
  await prisma.flightOperation.create({ data: { flightId, event: "LANDED" } });
  await audit("ARRIVAL", `FLIGHT ${flight.flightNumber} LANDED`, flight.flightNumber);
  return updated;
}

export async function assignArrivalGate(flightId: string, gateId: string) {
  const flight = await prisma.flight.findUniqueOrThrow({ where: { id: flightId } });
  if (["DISEMBARKATION", "COMPLETED", "CLOSED"].includes(flight.status)) {
    throw new OpsError("OPS-118", "ACTION DENIED", `Cannot reassign arrival gate — flight is already ${flight.status}.`);
  }
  await assignGate(flightId, gateId);
  return prisma.flight.update({ where: { id: flightId }, data: { status: "AT GATE" }, include: { gate: true, aircraft: true } });
}

export async function startDisembarkation(flightId: string) {
  const flight = await prisma.flight.findUniqueOrThrow({ where: { id: flightId } });
  const updated = await prisma.flight.update({ where: { id: flightId }, data: { status: "DISEMBARKATION" } });
  await audit("ARRIVAL", `DISEMBARKATION STARTED — ${flight.flightNumber}`, flight.flightNumber);
  return updated;
}

export async function deplanePassenger(bookingId: string) {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (!booking.boarded) {
    throw new OpsError("OPS-109", "DEPLANE DENIED", "Passenger was never boarded.");
  }
  return prisma.booking.update({ where: { id: bookingId }, data: { deplaned: true, deplanedAt: new Date() } });
}

export async function deplaneAll(flightId: string) {
  const bookings = await prisma.booking.findMany({ where: { flightId, boarded: true, deplaned: false } });
  await prisma.booking.updateMany({
    where: { flightId, boarded: true, deplaned: false },
    data: { deplaned: true, deplanedAt: new Date() },
  });
  return bookings.length;
}

export async function closeArrival(flightId: string) {
  const flight = await prisma.flight.findUniqueOrThrow({ where: { id: flightId } });
  const updated = await prisma.flight.update({ where: { id: flightId }, data: { status: "COMPLETED" } });
  await audit("ARRIVAL", `ARRIVAL CLOSED — ${flight.flightNumber}`, flight.flightNumber);
  return updated;
}

export async function closeFlight(flightId: string) {
  const flight = await prisma.flight.findUniqueOrThrow({
    where: { id: flightId },
    include: { bookings: { include: { baggage: true } } },
  });
  const summary = {
    flightNumber: flight.flightNumber,
    route: `${flight.origin} -> ${flight.destination}`,
    totalPassengers: flight.bookings.filter((b) => b.status !== "CANCELLED").length,
    boarded: flight.bookings.filter((b) => b.boarded).length,
    noShow: flight.bookings.filter((b) => b.noShow).length,
    deplaned: flight.bookings.filter((b) => b.deplaned).length,
    totalBags: flight.bookings.flatMap((b) => b.baggage).length,
    bagsClaimed: flight.bookings.flatMap((b) => b.baggage).filter((bg) => bg.status === "CLAIMED").length,
    closedAt: new Date().toISOString(),
  };
  await prisma.flight.update({ where: { id: flightId }, data: { status: "CLOSED", closedAt: new Date() } });
  await prisma.flightOperation.create({
    data: { flightId, event: "CLOSED", detail: JSON.stringify(summary) },
  });
  await audit("SYSTEM", `FLIGHT ${flight.flightNumber} CLOSED — SUMMARY GENERATED`, flight.flightNumber);
  return summary;
}
