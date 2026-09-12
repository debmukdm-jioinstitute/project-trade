import { prisma } from "../lib/prisma.js";
import { audit } from "../lib/audit.js";
import { OpsError } from "../lib/errors.js";
import { generatePNR, generateDocumentId } from "../lib/ids.js";

export async function createBooking(input: {
  flightId: string;
  passenger: { name: string; dob?: string; gender?: string; mobile?: string; email?: string; passportNo?: string };
  fareType?: string;
  seatNumber?: string;
  baggageAllowanceKg?: number;
  mealSelection?: string;
  specialAssistance?: string;
}) {
  const flight = await prisma.flight.findUniqueOrThrow({ where: { id: input.flightId } });

  const bookedCount = await prisma.booking.count({
    where: { flightId: input.flightId, status: { not: "CANCELLED" } },
  });
  const seatCount = await prisma.seat.count({ where: { flightId: input.flightId } });
  if (seatCount > 0 && bookedCount >= seatCount) {
    throw new OpsError("OPS-110", "CAPACITY EXCEEDED", "Cannot exceed aircraft seat capacity.");
  }

  let pnr = generatePNR();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.booking.findUnique({ where: { pnr } });
    if (!exists) break;
    pnr = generatePNR();
  }

  const passenger = await prisma.passenger.create({ data: input.passenger });

  const booking = await prisma.booking.create({
    data: {
      pnr,
      passengerId: passenger.id,
      flightId: input.flightId,
      fareType: input.fareType ?? "SAVER",
      baggageAllowanceKg: input.baggageAllowanceKg ?? 15,
      mealSelection: input.mealSelection ?? null,
      specialAssistance: input.specialAssistance ?? null,
    },
  });

  if (input.seatNumber) {
    await assignSeat(booking.id, input.seatNumber);
  }

  await prisma.document.create({
    data: {
      documentId: generateDocumentId("BKG"),
      type: "BOOKING_CONFIRMATION",
      bookingId: booking.id,
      flightNumber: flight.flightNumber,
      payload: JSON.stringify({ pnr, passenger: passenger.name, flight: flight.flightNumber }),
    },
  });

  await audit("BOOKING", `BOOKING CREATED — ${passenger.name}`, pnr);
  return prisma.booking.findUnique({
    where: { id: booking.id },
    include: { passenger: true, flight: true, seat: true },
  });
}

export async function assignSeat(bookingId: string, seatNumber: string) {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const seat = await prisma.seat.findUnique({
    where: { flightId_seatNumber: { flightId: booking.flightId, seatNumber } },
  });
  if (!seat) throw new OpsError("OPS-111", "INVALID SEAT", `Seat ${seatNumber} does not exist on this flight.`);
  if (seat.status === "BOOKED" || seat.status === "CHECKED-IN") {
    throw new OpsError("OPS-112", "SEAT UNAVAILABLE", `Seat ${seatNumber} is already occupied.`);
  }

  const currentSeat = await prisma.seat.findUnique({ where: { bookingId } });
  if (currentSeat) {
    await prisma.seat.update({ where: { id: currentSeat.id }, data: { status: "AVAILABLE", bookingId: null } });
  }

  await prisma.seat.update({ where: { id: seat.id }, data: { status: "BOOKED", bookingId } });
  await audit("BOOKING", `SEAT ${seatNumber} ASSIGNED`, booking.pnr);
  return prisma.seat.findUnique({ where: { id: seat.id } });
}

export async function searchPnr(pnr: string) {
  return prisma.booking.findUnique({
    where: { pnr: pnr.toUpperCase() },
    include: {
      passenger: true,
      flight: { include: { aircraft: true, gate: true } },
      seat: true,
      baggage: true,
      baggageCharges: true,
      mealVouchers: true,
      loungePasses: true,
      boardingPasses: { orderBy: { createdAt: "desc" } },
      specialServices: true,
      transfer: { include: { outboundFlight: true, inboundFlight: true } },
    },
  });
}

export async function cancelBooking(bookingId: string) {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const seat = await prisma.seat.findUnique({ where: { bookingId } });
  if (seat) await prisma.seat.update({ where: { id: seat.id }, data: { status: "AVAILABLE", bookingId: null } });
  const updated = await prisma.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } });
  await audit("BOOKING", "BOOKING CANCELLED", booking.pnr);
  return updated;
}

export async function checkIn(bookingId: string) {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { flight: true } });
  if (booking.status === "CANCELLED") {
    throw new OpsError("OPS-113", "CHECK-IN DENIED", "Booking is cancelled.");
  }
  if (!booking.flight.checkinOpen && booking.flight.status !== "CHECK-IN OPEN") {
    if (["CHECK-IN CLOSED", "BOARDING", "FINAL CALL", "GATE CLOSED", "DEPARTED"].includes(booking.flight.status)) {
      throw new OpsError("OPS-102", "CHECK-IN CLOSED", "Cannot check in after check-in closure.");
    }
    throw new OpsError("OPS-102", "CHECK-IN NOT OPEN", "Check-in has not been opened for this flight.");
  }
  const seat = await prisma.seat.findUnique({ where: { bookingId } });
  if (seat) await prisma.seat.update({ where: { id: seat.id }, data: { status: "CHECKED-IN" } });

  const seqCount = await prisma.booking.count({ where: { flightId: booking.flightId, checkedIn: true } });

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { checkedIn: true, checkedInAt: new Date(), sequenceNumber: seqCount + 1 },
  });
  await audit("CHECKIN", "PASSENGER CHECKED IN", booking.pnr);
  return updated;
}

export async function addBaggageToBooking(bookingId: string, weightKg: number) {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  return { booking, weightKg };
}
