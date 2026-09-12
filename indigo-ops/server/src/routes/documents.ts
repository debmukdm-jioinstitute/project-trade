import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { handle } from "../lib/handle.js";
import { qrSvg, barcodeSvg } from "../lib/qr.js";

export const documentsRouter = Router();

documentsRouter.get(
  "/",
  handle(async (req, res) => {
    const { pnr, type } = req.query as { pnr?: string; type?: string };
    const documents = await prisma.document.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(pnr ? { booking: { pnr: pnr.toUpperCase() } } : {}),
      },
      include: { booking: { include: { passenger: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(documents);
  })
);

documentsRouter.get(
  "/qr",
  handle(async (req, res) => {
    const payload = String(req.query.payload ?? "");
    const svg = await qrSvg(payload);
    res.type("image/svg+xml").send(svg);
  })
);

documentsRouter.get(
  "/barcode",
  handle(async (req, res) => {
    const payload = String(req.query.payload ?? "");
    res.type("image/svg+xml").send(barcodeSvg(payload));
  })
);

// OPS> VERIFY QR — validates a simulated document reference such as 6E|BP|A7K9PQ|001
documentsRouter.get(
  "/verify",
  handle(async (req, res) => {
    const payload = String(req.query.payload ?? "");
    const parts = payload.split("|");
    if (parts.length < 3) {
      return res.json({ valid: false, reason: "MALFORMED REFERENCE" });
    }
    const [, docType, pnr] = parts;
    const booking = await prisma.booking.findUnique({
      where: { pnr: pnr?.toUpperCase() ?? "" },
      include: { passenger: true, flight: true, boardingPasses: true, mealVouchers: true, loungePasses: true },
    });
    if (!booking) return res.json({ valid: false, reason: "PNR NOT FOUND" });

    let status = "UNKNOWN";
    let issued = booking.createdAt;
    let expiry = booking.flight.departureDate;
    if (docType === "BP") {
      const bp = booking.boardingPasses.find((b) => b.qrPayload === payload) ?? booking.boardingPasses[0];
      status = bp?.status ?? "NOT FOUND";
      issued = bp?.createdAt ?? issued;
    } else if (docType === "MV") {
      const mv = booking.mealVouchers.find((v) => v.qrPayload === payload) ?? booking.mealVouchers[0];
      status = mv?.status ?? "NOT FOUND";
      issued = mv?.createdAt ?? issued;
      expiry = mv?.validity ?? expiry;
    } else if (docType === "LP") {
      const lp = booking.loungePasses.find((v) => v.qrPayload === payload) ?? booking.loungePasses[0];
      status = lp?.status ?? "NOT FOUND";
      issued = lp?.createdAt ?? issued;
      expiry = lp?.validity ?? expiry;
    }

    const valid = ["VALID", "ISSUED", "ACCEPTED"].includes(status);
    res.json({
      valid,
      documentType: docType,
      passenger: booking.passenger.name,
      flight: booking.flight.flightNumber,
      status,
      issued,
      expiry,
    });
  })
);
