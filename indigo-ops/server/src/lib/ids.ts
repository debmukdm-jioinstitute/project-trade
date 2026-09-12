// Mock ID / reference number generators. Prototype/simulation only — no real airline system integration.

const PNR_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 ambiguity

export function generatePNR(): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += PNR_CHARS[Math.floor(Math.random() * PNR_CHARS.length)];
  }
  return out;
}

let bagSeq = 0;
export function generateBagTag(flightNumber: string, origin: string, destination: string, pnr: string): string {
  bagSeq += 1;
  const seq = String(bagSeq % 999 + 1).padStart(3, "0");
  return `${flightNumber.replace(/\s/g, "")}-${origin}-${destination}-${pnr}-${seq}`;
}

let docSeq = 1000;
export function generateDocumentId(prefix: string): string {
  docSeq += 1;
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${docSeq}`;
}

export function generateTransactionId(): string {
  return `TXN${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 9000 + 1000)}`;
}

export function generateVoucherNo(): string {
  return `MV${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
}

export function generateLoungePassId(): string {
  return `LP${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
}

export function generateBoardingPassNo(): string {
  return `BP${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 900 + 100)}`;
}
