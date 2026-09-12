import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { handle } from "../lib/handle.js";
import * as voucherService from "../services/voucherService.js";

export const vouchersRouter = Router();

vouchersRouter.get(
  "/",
  handle(async (req, res) => {
    const { flightId } = req.query as { flightId?: string };
    const vouchers = await prisma.mealVoucher.findMany({
      where: flightId ? { flightId } : {},
      include: { booking: { include: { passenger: true } }, flight: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(vouchers);
  })
);

vouchersRouter.post(
  "/:id/redeem",
  handle(async (req, res) => {
    res.json(await voucherService.redeemVoucher(req.params.id));
  })
);

export const loungeRouter = Router();

loungeRouter.get(
  "/",
  handle(async (req, res) => {
    const { flightId } = req.query as { flightId?: string };
    const passes = await prisma.loungePass.findMany({
      where: flightId ? { flightId } : {},
      include: { booking: { include: { passenger: true } }, flight: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(passes);
  })
);

loungeRouter.post(
  "/:id/use",
  handle(async (req, res) => {
    res.json(await voucherService.useLoungePass(req.params.id));
  })
);
