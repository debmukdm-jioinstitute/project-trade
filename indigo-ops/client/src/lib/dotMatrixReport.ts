// Renders a flight manifest as fixed-width, 80-column plain text styled after
// a dot-matrix / courier continuous-feed printout — for logistics teams who
// print or archive flight paperwork in that format.
import type { FlightManifest } from "./api";

const WIDTH = 80;
const RULE = "=".repeat(WIDTH);
const THIN = "-".repeat(WIDTH);

function center(text: string): string {
  const pad = Math.max(0, Math.floor((WIDTH - text.length) / 2));
  return " ".repeat(pad) + text;
}

function row(cols: { text: string; width: number }[]): string {
  return cols.map((c) => c.text.slice(0, c.width).padEnd(c.width)).join(" ").trimEnd();
}

function yn(v: boolean): string {
  return v ? "YES" : "NO ";
}

export function buildDotMatrixReport(m: FlightManifest): string {
  const lines: string[] = [];
  const sprocket = "*" + " ".repeat(WIDTH - 2) + "*";

  lines.push(sprocket);
  lines.push(RULE);
  lines.push(center("INDIGO OPS // FLIGHT MANIFEST REPORT"));
  lines.push(center("*** DOT-MATRIX / COURIER PRINT FORMAT — LOGISTICAL PLANNING COPY ***"));
  lines.push(RULE);
  lines.push("");
  lines.push(`FLIGHT : ${m.flight.flightNumber}`.padEnd(28) + `DATE: ${m.flight.departureDate}`.padEnd(24) + `PRINTED: ${m.generatedAt.slice(0, 19).replace("T", " ")}`);
  lines.push(`ROUTE  : ${m.flight.origin} -> ${m.flight.destination}`.padEnd(28) + `AIRCRAFT: ${m.flight.aircraft?.registration ?? "UNASSIGNED"} (${m.flight.aircraft?.type ?? "-"})`);
  lines.push(`STD/ETD: ${m.flight.std} / ${m.flight.etd ?? "-"}`.padEnd(28) + `GATE: ${m.flight.gate?.code ?? "UNASSIGNED"}`.padEnd(24) + `TERMINAL: ${m.flight.terminal}`);
  lines.push(`STATUS : ${m.flight.status}`.padEnd(28) + `CREW: ${m.flight.crew}`.padEnd(24) + `DELAY: ${m.flight.delayMinutes} MIN`);
  lines.push("");

  lines.push(THIN);
  lines.push("SECTION 1 / FLIGHT DATA & CHECKPOINT SUMMARY");
  lines.push(THIN);
  const cp = m.checkpoints;
  lines.push(row([{ text: `TOTAL PAX........ ${cp.totalPax}`, width: 40 }, { text: `CHECKED-IN........ ${cp.checkedIn}`, width: 40 }]));
  lines.push(row([{ text: `BAG DROP.......... ${cp.bagDrop}`, width: 40 }, { text: `SECURITY CLEARED.. ${cp.securityCleared}`, width: 40 }]));
  lines.push(row([{ text: `LOUNGE USED....... ${cp.loungeUsed}`, width: 40 }, { text: `BOARDED........... ${cp.boarded}`, width: 40 }]));
  lines.push(row([{ text: `NO-SHOW........... ${cp.noShow}`, width: 40 }, { text: `OFFLOADED......... ${cp.offloaded}`, width: 40 }]));
  lines.push(row([{ text: `DEPLANED.......... ${cp.deplaned}`, width: 40 }, { text: `BAGS LOADED/TOTAL.. ${cp.bagsLoaded}/${cp.bagsTotal}`, width: 40 }]));
  lines.push(`EXCESS BAGGAGE REVENUE (PAID)..... INR ${cp.excessBaggageRevenue.toLocaleString("en-IN")}`);
  lines.push("");

  lines.push(THIN);
  lines.push("SECTION 2 / CUSTOMER DATA & CHECKPOINTS");
  lines.push(THIN);
  const custCols = [
    { text: "PNR", width: 8 },
    { text: "PASSENGER NAME", width: 22 },
    { text: "SEAT", width: 6 },
    { text: "CHK-IN", width: 8 },
    { text: "BAGDRP", width: 8 },
    { text: "LOUNGE", width: 8 },
    { text: "BOARD", width: 8 },
    { text: "STATUS", width: 10 },
  ];
  lines.push(row(custCols));
  lines.push(custCols.map((c) => "-".repeat(c.width)).join(" "));
  for (const p of m.passengers) {
    const status = p.boarded ? "BOARDED" : p.noShow ? "NO-SHOW" : p.offloaded ? "OFFLOADED" : p.checkedIn ? "CHECKED-IN" : "PENDING";
    lines.push(
      row([
        { text: p.pnr, width: 8 },
        { text: p.name.toUpperCase(), width: 22 },
        { text: p.seat ?? "-", width: 6 },
        { text: yn(p.checkedIn), width: 8 },
        { text: yn(p.bagDrop), width: 8 },
        { text: yn(p.loungeUsed), width: 8 },
        { text: yn(p.boarded), width: 8 },
        { text: status, width: 10 },
      ])
    );
    if (p.specialServices.length > 0) {
      lines.push(`         >> SPECIAL SERVICE: ${p.specialServices.join(", ")}`);
    }
  }
  lines.push("");

  lines.push(THIN);
  lines.push("SECTION 3 / BAGGAGE — LOGISTICAL PLANNING");
  lines.push(THIN);
  const bagCols = [
    { text: "TAG NUMBER", width: 30 },
    { text: "PNR", width: 8 },
    { text: "WEIGHT", width: 8 },
    { text: "TYPE", width: 10 },
    { text: "DEST", width: 6 },
    { text: "STATUS", width: 12 },
  ];
  lines.push(row(bagCols));
  lines.push(bagCols.map((c) => "-".repeat(c.width)).join(" "));
  for (const b of m.baggage) {
    lines.push(
      row([
        { text: b.tagNumber, width: 30 },
        { text: b.pnr, width: 8 },
        { text: `${b.weightKg}KG`, width: 8 },
        { text: b.bagType, width: 10 },
        { text: b.destination, width: 6 },
        { text: b.status, width: 12 },
      ])
    );
  }
  if (m.excessCharges.length > 0) {
    lines.push("");
    lines.push("  EXCESS BAGGAGE CHARGES:");
    for (const c of m.excessCharges) {
      lines.push(
        `    ${c.pnr.padEnd(8)} ${c.passenger.toUpperCase().padEnd(22)} EXCESS ${String(c.excessKg).padStart(5)}KG  RATE INR${c.ratePerKg}/KG  TOTAL INR${c.totalCharge}  [${c.paymentStatus}]`
      );
    }
  }
  lines.push("");

  lines.push(THIN);
  lines.push("SECTION 4 / MEAL & FOOD CHOICE");
  lines.push(THIN);
  if (m.mealVouchers.length === 0) {
    lines.push("  NO MEAL VOUCHERS ISSUED FOR THIS FLIGHT.");
  } else {
    const mealCols = [
      { text: "VOUCHER NO.", width: 16 },
      { text: "PNR", width: 8 },
      { text: "PASSENGER", width: 20 },
      { text: "FOOD CHOICE", width: 16 },
      { text: "STATUS", width: 10 },
    ];
    lines.push(row(mealCols));
    lines.push(mealCols.map((c) => "-".repeat(c.width)).join(" "));
    for (const v of m.mealVouchers) {
      lines.push(
        row([
          { text: v.voucherNo, width: 16 },
          { text: v.pnr, width: 8 },
          { text: v.passenger.toUpperCase(), width: 20 },
          { text: v.mealType.replace(/_/g, " "), width: 16 },
          { text: v.status, width: 10 },
        ])
      );
    }
  }
  lines.push("");

  lines.push(THIN);
  lines.push("SECTION 5 / LOUNGE USAGE — CUSTOMERS");
  lines.push(THIN);
  if (m.loungePasses.length === 0) {
    lines.push("  NO LOUNGE PASSES ISSUED FOR THIS FLIGHT.");
  } else {
    const loungeCols = [
      { text: "PASS ID", width: 16 },
      { text: "PNR", width: 8 },
      { text: "PASSENGER", width: 20 },
      { text: "LOUNGE", width: 14 },
      { text: "ACCESS TYPE", width: 18 },
      { text: "STATUS", width: 10 },
    ];
    lines.push(row(loungeCols));
    lines.push(loungeCols.map((c) => "-".repeat(c.width)).join(" "));
    for (const l of m.loungePasses) {
      lines.push(
        row([
          { text: l.passId, width: 16 },
          { text: l.pnr, width: 8 },
          { text: l.passenger.toUpperCase(), width: 20 },
          { text: l.lounge, width: 14 },
          { text: l.accessType.replace(/_/g, " "), width: 18 },
          { text: l.status, width: 10 },
        ])
      );
    }
  }
  lines.push("");

  lines.push(RULE);
  lines.push(center("END OF REPORT — INDIGO OPS PROTOTYPE / SIMULATION — NOT A REAL AIRLINE DOCUMENT"));
  lines.push(RULE);
  lines.push(sprocket);
  lines.push("\f"); // form-feed, continuous-feed page-out

  return lines.join("\n");
}

export function downloadDotMatrixReport(m: FlightManifest) {
  const text = buildDotMatrixReport(m);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${m.flight.flightNumber}-manifest-${m.flight.departureDate}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
