import express from "express";
import cors from "cors";

import { flightsRouter } from "./routes/flights.js";
import { aircraftRouter } from "./routes/aircraft.js";
import { gatesRouter } from "./routes/gates.js";
import { bookingsRouter } from "./routes/bookings.js";
import { baggageRouter } from "./routes/baggage.js";
import { vouchersRouter, loungeRouter } from "./routes/vouchers.js";
import { boardingRouter } from "./routes/boarding.js";
import { documentsRouter } from "./routes/documents.js";
import { searchRouter } from "./routes/search.js";
import { auditRouter } from "./routes/audit.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { reportsRouter } from "./routes/reports.js";
import { passengersRouter, transfersRouter } from "./routes/passengers.js";
import { systemRouter } from "./routes/system.js";
import { commandRouter } from "./routes/command.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/flights", flightsRouter);
app.use("/api/aircraft", aircraftRouter);
app.use("/api/gates", gatesRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/baggage", baggageRouter);
app.use("/api/vouchers", vouchersRouter);
app.use("/api/lounge", loungeRouter);
app.use("/api/boarding", boardingRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/search", searchRouter);
app.use("/api/audit", auditRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/passengers", passengersRouter);
app.use("/api/transfers", transfersRouter);
app.use("/api/system", systemRouter);
app.use("/api/command", commandRouter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`INDIGO OPS server online — http://localhost:${PORT}`);
});
