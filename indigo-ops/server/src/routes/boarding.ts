import { Router } from "express";
import { handle } from "../lib/handle.js";
import * as boardingService from "../services/boardingService.js";
import { deplanePassenger } from "../services/flightService.js";

export const boardingRouter = Router();

boardingRouter.get(
  "/:flightId/summary",
  handle(async (req, res) => {
    res.json(await boardingService.boardingSummary(req.params.flightId));
  })
);

boardingRouter.post(
  "/board/:bookingId",
  handle(async (req, res) => {
    res.json(await boardingService.boardPassenger(req.params.bookingId));
  })
);

boardingRouter.post(
  "/undo/:bookingId",
  handle(async (req, res) => {
    res.json(await boardingService.undoBoard(req.params.bookingId));
  })
);

boardingRouter.post(
  "/no-show/:bookingId",
  handle(async (req, res) => {
    res.json(await boardingService.markNoShow(req.params.bookingId));
  })
);

boardingRouter.post(
  "/offload/:bookingId",
  handle(async (req, res) => {
    res.json(await boardingService.offloadPassenger(req.params.bookingId));
  })
);

boardingRouter.post(
  "/void-pass/:bpId",
  handle(async (req, res) => {
    res.json(await boardingService.voidBoardingPass(req.params.bpId));
  })
);

boardingRouter.post(
  "/deplane/:bookingId",
  handle(async (req, res) => {
    res.json(await deplanePassenger(req.params.bookingId));
  })
);
