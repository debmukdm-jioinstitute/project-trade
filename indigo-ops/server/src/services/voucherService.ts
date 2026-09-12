import { prisma } from "../lib/prisma.js";
import { audit } from "../lib/audit.js";
import { OpsError } from "../lib/errors.js";
import { generateVoucherNo, generateLoungePassId, generateDocumentId } from "../lib/ids.js";
import { qrSvg } from "../lib/qr.js";

export async function issueMealVoucher(bookingId: string, mealType: string) {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { flight: true } });
  const voucherNo = generateVoucherNo();
  const payload = `6E|MV|${booking.pnr}|${voucherNo}`;

  const voucher = await prisma.mealVoucher.create({
    data: {
      voucherNo,
      bookingId,
      flightId: booking.flightId,
      mealType,
      gate: booking.flight.gateId ?? null,
      validity: booking.flight.departureDate,
      qrPayload: payload,
    },
  });

  await prisma.document.create({
    data: {
      documentId: generateDocumentId("MV"),
      type: "MEAL_VOUCHER",
      bookingId,
      flightNumber: booking.flight.flightNumber,
      payload: JSON.stringify({ voucherNo, mealType }),
    },
  });

  await audit("VOUCHER", `MEAL VOUCHER ${voucherNo} ISSUED (${mealType})`, booking.pnr);
  return voucher;
}

export async function redeemVoucher(voucherId: string) {
  const voucher = await prisma.mealVoucher.findUniqueOrThrow({ where: { id: voucherId }, include: { booking: true } });
  if (voucher.status === "EXPIRED") {
    throw new OpsError("OPS-114", "REDEEM DENIED", "Cannot redeem an expired voucher.");
  }
  if (voucher.status === "CANCELLED") {
    throw new OpsError("OPS-114", "REDEEM DENIED", "Voucher has been cancelled.");
  }
  if (voucher.status === "REDEEMED") {
    throw new OpsError("OPS-114", "REDEEM DENIED", "Voucher already redeemed.");
  }
  const updated = await prisma.mealVoucher.update({ where: { id: voucherId }, data: { status: "REDEEMED" } });
  await audit("VOUCHER", `VOUCHER ${voucher.voucherNo} REDEEMED`, voucher.booking.pnr);
  return updated;
}

export async function issueLoungePass(
  bookingId: string,
  opts: { accessType?: string; airport?: string; terminal?: string; lounge?: string } = {}
) {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { flight: true } });
  const passId = generateLoungePassId();
  const payload = `6E|LP|${booking.pnr}|${passId}`;

  const pass = await prisma.loungePass.create({
    data: {
      passId,
      bookingId,
      flightId: booking.flightId,
      airport: opts.airport ?? booking.flight.origin,
      terminal: opts.terminal ?? booking.flight.terminal,
      lounge: opts.lounge ?? "INDIGO LOUNGE",
      accessType: opts.accessType ?? "COMPLIMENTARY",
      validity: booking.flight.departureDate,
      qrPayload: payload,
    },
  });

  await prisma.document.create({
    data: {
      documentId: generateDocumentId("LP"),
      type: "LOUNGE_PASS",
      bookingId,
      flightNumber: booking.flight.flightNumber,
      payload: JSON.stringify({ passId, accessType: pass.accessType }),
    },
  });

  await audit("LOUNGE", `LOUNGE PASS ${passId} ISSUED (${pass.accessType})`, booking.pnr);
  return pass;
}

export async function useLoungePass(passId: string) {
  const pass = await prisma.loungePass.findUniqueOrThrow({ where: { id: passId }, include: { booking: true } });
  if (pass.status === "CANCELLED") {
    throw new OpsError("OPS-115", "ACCESS DENIED", "Cannot use a cancelled lounge pass.");
  }
  if (pass.status === "EXPIRED") {
    throw new OpsError("OPS-115", "ACCESS DENIED", "Lounge pass has expired.");
  }
  if (pass.status === "USED") {
    throw new OpsError("OPS-115", "ACCESS DENIED", "Lounge pass already used.");
  }
  const updated = await prisma.loungePass.update({ where: { id: passId }, data: { status: "USED" } });
  await audit("LOUNGE", `LOUNGE PASS ${pass.passId} USED`, pass.booking.pnr);
  return updated;
}

export async function renderQr(payload: string) {
  return qrSvg(payload);
}
