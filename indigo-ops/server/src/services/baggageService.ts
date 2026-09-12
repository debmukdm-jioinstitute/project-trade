import { prisma } from "../lib/prisma.js";
import { audit } from "../lib/audit.js";
import { OpsError } from "../lib/errors.js";
import { generateBagTag, generateDocumentId, generateTransactionId } from "../lib/ids.js";

const DEFAULT_RATE_PER_KG = 600;

export async function acceptBaggage(bookingId: string, weightKg: number, bagType = "CHECKED") {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { flight: true } });

  const tagNumber = generateBagTag(booking.flight.flightNumber, booking.flight.origin, booking.flight.destination, booking.pnr);
  const baggage = await prisma.baggage.create({
    data: {
      tagNumber,
      bookingId,
      flightId: booking.flightId,
      weightKg,
      bagType,
      destination: booking.flight.destination,
      status: "ACCEPTED",
    },
  });

  await prisma.document.create({
    data: {
      documentId: generateDocumentId("TAG"),
      type: "BAGGAGE_TAG",
      bookingId,
      flightNumber: booking.flight.flightNumber,
      payload: JSON.stringify({ tagNumber, weightKg, destination: booking.flight.destination }),
    },
  });

  await audit("BAGGAGE", `${weightKg} KG ACCEPTED — TAG ${tagNumber}`, booking.pnr);

  const existingBags = await prisma.baggage.findMany({ where: { bookingId } });
  const totalWeight = existingBags.reduce((s, b) => s + b.weightKg, 0);
  let charge = null;
  if (totalWeight > booking.baggageAllowanceKg) {
    charge = await calculateExcessCharge(bookingId);
  }

  return { baggage, charge };
}

export async function calculateExcessCharge(bookingId: string, ratePerKg = DEFAULT_RATE_PER_KG) {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { baggage: true } });
  const actualKg = booking.baggage.reduce((s, b) => s + b.weightKg, 0);
  const excessKg = Math.max(0, actualKg - booking.baggageAllowanceKg);
  const totalCharge = Math.round(excessKg * ratePerKg);

  if (excessKg <= 0) return null;

  const charge = await prisma.baggageCharge.create({
    data: {
      bookingId,
      allowanceKg: booking.baggageAllowanceKg,
      actualKg,
      excessKg,
      ratePerKg,
      totalCharge,
    },
  });
  await audit("BAGGAGE", `EXCESS BAGGAGE ${excessKg}KG — ₹${totalCharge} CHARGED`, booking.pnr);
  return charge;
}

export async function markChargePaid(chargeId: string) {
  const charge = await prisma.baggageCharge.findUniqueOrThrow({ where: { id: chargeId }, include: { booking: true } });
  const transactionId = generateTransactionId();
  const updated = await prisma.baggageCharge.update({
    where: { id: chargeId },
    data: { paymentStatus: "PAID", transactionId },
  });
  await prisma.payment.create({
    data: {
      bookingId: charge.bookingId,
      purpose: "BAGGAGE",
      amount: charge.totalCharge,
      transactionId,
      status: "SUCCESS",
    },
  });
  await prisma.document.create({
    data: {
      documentId: generateDocumentId("RCT"),
      type: "BAGGAGE_RECEIPT",
      bookingId: charge.bookingId,
      payload: JSON.stringify({ amount: charge.totalCharge, transactionId }),
    },
  });
  await audit("BAGGAGE", `EXCESS BAGGAGE PAID — TXN ${transactionId}`, charge.booking.pnr);
  return updated;
}

export async function updateBagStatus(bagId: string, status: string) {
  const bag = await prisma.baggage.findUniqueOrThrow({ where: { id: bagId }, include: { booking: true } });
  const updated = await prisma.baggage.update({ where: { id: bagId }, data: { status } });
  await audit("BAGGAGE", `BAG ${bag.tagNumber} -> ${status}`, bag.booking.pnr);
  return updated;
}

export async function reconcileFlight(flightId: string) {
  const bags = await prisma.baggage.findMany({
    where: { flightId },
    include: { booking: { include: { passenger: true } } },
  });
  const totalChecked = bags.length;
  const loaded = bags.filter((b) => b.status === "LOADED" || b.status === "ARRIVED" || b.status === "CLAIMED");
  const unloaded = bags.filter((b) => b.status !== "LOADED" && b.status !== "ARRIVED" && b.status !== "CLAIMED" && b.status !== "HELD");
  const transfer = bags.filter((b) => b.bagType === "TRANSFER");
  const missing = bags.filter((b) => b.status === "UNLOADED");

  const rows = bags.map((b) => {
    const mismatch = !b.booking.boarded && b.status === "LOADED";
    return {
      bagId: b.id,
      tagNumber: b.tagNumber,
      passenger: b.booking.passenger.name,
      pnr: b.booking.pnr,
      weightKg: b.weightKg,
      status: b.status,
      boarded: b.booking.boarded,
      mismatch,
    };
  });

  return {
    totalChecked,
    totalLoaded: loaded.length,
    unloaded: unloaded.length,
    transferBags: transfer.length,
    missing: missing.length,
    mismatches: rows.filter((r) => r.mismatch).length,
    rows,
  };
}
