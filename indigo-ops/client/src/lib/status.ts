export function statusBadgeClass(status: string): string {
  const s = status.toUpperCase();
  if (["DEPARTED", "BOARDED", "LOADED", "CHECKED-IN", "PAID", "COMPLETE", "COMPLETED", "ARRIVED", "CLAIMED", "REDEEMED", "USED", "VALID", "CONFIRMED", "SUCCESS"].includes(s))
    return "badge-green";
  if (["DELAYED", "PENDING", "BOARDING", "FINAL CALL", "AT-GATE", "ISSUED", "SCHEDULED", "ASSIGNED", "CREATED", "ACCEPTED"].includes(s))
    return "badge-amber";
  if (["CANCELLED", "NO-SHOW", "NO_SHOW", "OFFLOADED", "MISSING", "MISMATCH", "VOIDED", "EXPIRED", "GATE CLOSED", "CLOSED"].includes(s))
    return "badge-red";
  if (["AVAILABLE", "CHECK-IN OPEN", "OPEN"].includes(s)) return "badge-cyan";
  return "badge-dim";
}

export function fmtTime(t?: string | null): string {
  return t ?? "--:--";
}

export function fmtMoney(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}
