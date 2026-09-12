import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { handle } from "../lib/handle.js";
import * as bookingService from "../services/bookingService.js";
import * as baggageService from "../services/baggageService.js";
import * as voucherService from "../services/voucherService.js";
import * as boardingService from "../services/boardingService.js";

export const bookingsRouter = Router();

bookingsRouter.post(
  "/",
  handle(async (req, res) => {
    const booking = await bookingService.createBooking(req.body);
    res.status(201).json(booking);
  })
);

bookingsRouter.get(
  "/pnr/:pnr",
  handle(async (req, res) => {
    const booking = await bookingService.searchPnr(req.params.pnr);
    if (!booking) {
      return res.status(404).json({ error: { code: "OPS-404", title: "PNR NOT FOUND", message: `No booking found for PNR ${req.params.pnr.toUpperCase()}.` } });
    }
    res.json(booking);
  })
);

bookingsRouter.get(
  "/:id",
  handle(async (req, res) => {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        passenger: true,
        flight: { include: { gate: true, aircraft: true } },
        seat: true,
        baggage: true,
        baggageCharges: true,
        mealVouchers: true,
        loungePasses: true,
        boardingPasses: { orderBy: { createdAt: "desc" } },
        specialServices: true,
      },
    });
    res.json(booking);
  })
);

bookingsRouter.post(
  "/:id/cancel",
  handle(async (req, res) => {
    res.json(await bookingService.cancelBooking(req.params.id));
  })
);

bookingsRouter.post(
  "/:id/seat",
  handle(async (req, res) => {
    res.json(await bookingService.assignSeat(req.params.id, req.body.seatNumber));
  })
);

bookingsRouter.post(
  "/:id/checkin",
  handle(async (req, res) => {
    res.json(await bookingService.checkIn(req.params.id));
  })
);

bookingsRouter.post(
  "/:id/baggage",
  handle(async (req, res) => {
    const result = await baggageService.acceptBaggage(req.params.id, Number(req.body.weightKg), req.body.bagType);
    res.status(201).json(result);
  })
);

bookingsRouter.post(
  "/:id/baggage/excess/recalculate",
  handle(async (req, res) => {
    res.json(await baggageService.calculateExcessCharge(req.params.id, req.body.ratePerKg));
  })
);

bookingsRouter.post(
  "/:id/meal-voucher",
  handle(async (req, res) => {
    res.status(201).json(await voucherService.issueMealVoucher(req.params.id, req.body.mealType ?? "STANDARD"));
  })
);

bookingsRouter.post(
  "/:id/lounge-pass",
  handle(async (req, res) => {
    res.status(201).json(await voucherService.issueLoungePass(req.params.id, req.body));
  })
);

bookingsRouter.post(
  "/:id/boarding-pass",
  handle(async (req, res) => {
    res.status(201).json(await boardingService.generateBoardingPass(req.params.id));
  })
);

bookingsRouter.post(
  "/:id/special-service",
  handle(async (req, res) => {
    const service = await prisma.specialService.create({
      data: { bookingId: req.params.id, serviceType: req.body.serviceType, notes: req.body.notes ?? null },
    });
    res.status(201).json(service);
  })
);

// Bulk-approve a selected set of passengers in one click: check-in (if
// pending) + security-clear their baggage + generate a boarding pass.
bookingsRouter.post(
  "/bulk-approve",
  handle(async (req, res) => {
    const bookingIds: string[] = Array.isArray(req.body.bookingIds) ? req.body.bookingIds : [];
    const approved: string[] = [];
    const failed: { bookingId: string; message: string }[] = [];

    for (const id of bookingIds) {
      try {
        const booking = await prisma.booking.findUniqueOrThrow({ where: { id } });
        if (!booking.checkedIn) await bookingService.checkIn(id);
        await prisma.baggage.updateMany({
          where: { bookingId: id, status: { in: ["CREATED", "ACCEPTED"] } },
          data: { status: "SECURITY_CLEARED" },
        });
        const hasValidBp = await prisma.boardingPass.findFirst({ where: { bookingId: id, status: "VALID" } });
        if (!hasValidBp) await boardingService.generateBoardingPass(id);
        approved.push(id);
      } catch (err) {
        failed.push({ bookingId: id, message: (err as Error).message });
      }
    }

    res.json({ approved, failed });
  })
);
