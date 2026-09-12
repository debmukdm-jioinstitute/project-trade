import { prisma } from "../lib/prisma.js";
import { audit } from "../lib/audit.js";
import { OpsError } from "../lib/errors.js";
import { generateBoardingPassNo, generateDocumentId } from "../lib/ids.js";

export async function generateBoardingPass(bookingId: string) {
  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { flight: { include: { gate: true } }, seat: true },
  });
  if (!booking.checkedIn) {
    throw new OpsError("OPS-103", "BOARDING PASS DENIED", "Cannot generate a boarding pass before check-in.");
  }
  if (!booking.seat) {
    throw new OpsError("OPS-116", "NO SEAT ASSIGNED", "Assign a seat before generating a boarding pass.");
  }

  const documentNo = generateBoardingPassNo();
  const payload = `6E|BP|${booking.pnr}|${booking.sequenceNumber ?? "000"}`;

  await prisma.boardingPass.updateMany({
    where: { bookingId, status: "VALID" },
    data: { status: "VOIDED" },
  });

  const bp = await prisma.boardingPass.create({
    data: {
      documentNo,
      bookingId,
      flightId: booking.flightId,
      seatNumber: booking.seat.seatNumber,
      boardingGroup: booking.boardingGroup,
      sequenceNumber: booking.sequenceNumber ?? 0,
      gate: booking.flight.gate?.code ?? null,
      boardingTime: booking.flight.std,
      qrPayload: payload,
    },
  });

  await prisma.document.create({
    data: {
      documentId: generateDocumentId("BP"),
      type: "BOARDING_PASS",
      bookingId,
      flightNumber: booking.flight.flightNumber,
      payload: JSON.stringify({ documentNo, seat: booking.seat.seatNumber }),
    },
  });

  await audit("BOARDING", `BOARDING PASS ${documentNo} GENERATED`, booking.pnr);
  return bp;
}

export async function voidBoardingPass(bpId: string) {
  const bp = await prisma.boardingPass.findUniqueOrThrow({ where: { id: bpId }, include: { booking: true } });
  const updated = await prisma.boardingPass.update({ where: { id: bpId }, data: { status: "VOIDED" } });
  await audit("BOARDING", `BOARDING PASS ${bp.documentNo} VOIDED`, bp.booking.pnr);
  return updated;
}

export async function boardPassenger(bookingId: string) {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { flight: true } });
  if (!booking.checkedIn) {
    throw new OpsError("OPS-104", "BOARDING DENIED", "Passenger has not completed check-in.");
  }
  if (booking.flight.status === "GATE CLOSED" || booking.flight.status === "DEPARTED") {
    throw new OpsError("OPS-105", "BOARDING DENIED", "Cannot board after gate closure.");
  }
  const validBp = await prisma.boardingPass.findFirst({ where: { bookingId, status: "VALID" } });
  if (!validBp) {
    throw new OpsError("OPS-117", "BOARDING DENIED", "Cannot use a cancelled or missing boarding pass.");
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { boarded: true, boardedAt: new Date(), noShow: false, offloaded: false },
  });
  await prisma.boardingRecord.create({ data: { flightId: booking.flightId, bookingId, action: "BOARD" } });
  await audit("BOARDING", "PASSENGER BOARDED", booking.pnr);
  return updated;
}

export async function undoBoard(bookingId: string) {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { boarded: false, boardedAt: null },
  });
  await prisma.boardingRecord.create({ data: { flightId: booking.flightId, bookingId, action: "UNDO_BOARD" } });
  await audit("BOARDING", "BOARDING UNDONE", booking.pnr);
  return updated;
}

export async function markNoShow(bookingId: string) {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const updated = await prisma.booking.update({ where: { id: bookingId }, data: { noShow: true } });
  await prisma.boardingRecord.create({ data: { flightId: booking.flightId, bookingId, action: "NO_SHOW" } });
  await audit("BOARDING", "PASSENGER MARKED NO-SHOW", booking.pnr);
  return updated;
}

export async function offloadPassenger(bookingId: string) {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { offloaded: true, boarded: false },
  });
  await prisma.boardingRecord.create({ data: { flightId: booking.flightId, bookingId, action: "OFFLOAD" } });
  await audit("BOARDING", "PASSENGER OFFLOADED", booking.pnr);
  return updated;
}

export async function boardingSummary(flightId: string) {
  const bookings = await prisma.booking.findMany({
    where: { flightId, status: { not: "CANCELLED" } },
    include: { passenger: true, seat: true },
    orderBy: { sequenceNumber: "asc" },
  });
  const totalPax = bookings.length;
  const checkedIn = bookings.filter((b) => b.checkedIn).length;
  const boarded = bookings.filter((b) => b.boarded).length;
  const remaining = checkedIn - boarded;

  return {
    totalPax,
    checkedIn,
    boarded,
    remaining: Math.max(0, remaining),
    passengers: bookings.map((b) => ({
      bookingId: b.id,
      pnr: b.pnr,
      name: b.passenger.name,
      seat: b.seat?.seatNumber ?? "-",
      sequenceNumber: b.sequenceNumber,
      boardingGroup: b.boardingGroup,
      status: b.boarded
        ? "BOARDED"
        : b.noShow
        ? "NO-SHOW"
        : b.offloaded
        ? "OFFLOADED"
        : b.checkedIn
        ? "CHECKED-IN"
        : "NOT CHECKED-IN",
    })),
  };
}
