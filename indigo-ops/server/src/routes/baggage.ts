import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { handle } from "../lib/handle.js";
import * as baggageService from "../services/baggageService.js";

export const baggageRouter = Router();

baggageRouter.get(
  "/tag/:tagNumber",
  handle(async (req, res) => {
    const bag = await prisma.baggage.findUnique({
      where: { tagNumber: req.params.tagNumber },
      include: { booking: { include: { passenger: true, flight: true } } },
    });
    if (!bag) return res.status(404).json({ error: { code: "OPS-404", title: "BAG NOT FOUND", message: "Baggage tag not found." } });
    res.json(bag);
  })
);

baggageRouter.post(
  "/:id/status",
  handle(async (req, res) => {
    res.json(await baggageService.updateBagStatus(req.params.id, req.body.status));
  })
);

baggageRouter.post(
  "/charges/:id/pay",
  handle(async (req, res) => {
    res.json(await baggageService.markChargePaid(req.params.id));
  })
);

baggageRouter.get(
  "/reconcile/:flightId",
  handle(async (req, res) => {
    res.json(await baggageService.reconcileFlight(req.params.flightId));
  })
);
