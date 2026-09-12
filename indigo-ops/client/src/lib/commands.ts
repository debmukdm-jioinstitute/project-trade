// Command manifest for the OPS> terminal — mirrors server/src/routes/command.ts.
// Used for autocomplete suggestions and input syntax highlighting.

export interface CommandSpec {
  cmd: string; // fixed keyword portion, uppercase, space-separated
  args: string; // human-readable arg hint, e.g. "<PNR>" or "<NUM> [MIN]" or ""
  desc: string;
  group: "NAV" | "LOOKUP" | "PASSENGER" | "FLIGHT";
}

export const COMMANDS: CommandSpec[] = [
  { cmd: "HELP", args: "", desc: "Show available commands", group: "NAV" },
  { cmd: "DASHBOARD", args: "", desc: "Open operations dashboard", group: "NAV" },
  { cmd: "FLIGHTS", args: "", desc: "List today's flights", group: "NAV" },
  { cmd: "CHECKIN", args: "", desc: "Open check-in module", group: "NAV" },
  { cmd: "BAGGAGE", args: "", desc: "Open baggage module", group: "NAV" },
  { cmd: "VOUCHER", args: "", desc: "Open meal voucher module", group: "NAV" },
  { cmd: "LOUNGE", args: "", desc: "Open lounge pass module", group: "NAV" },
  { cmd: "BOARDING", args: "", desc: "Open boarding management", group: "NAV" },
  { cmd: "GATE", args: "", desc: "Open gate management", group: "NAV" },
  { cmd: "AIRCRAFT", args: "", desc: "List aircraft", group: "NAV" },
  { cmd: "DEPARTURE", args: "", desc: "Open departure control", group: "NAV" },
  { cmd: "ARRIVAL", args: "", desc: "Open arrival operations", group: "NAV" },
  { cmd: "REPORT", args: "", desc: "Open reports", group: "NAV" },
  { cmd: "SYSTEM STATUS", args: "", desc: "Show engine status", group: "NAV" },
  { cmd: "CLEAR", args: "", desc: "Clear terminal", group: "NAV" },

  { cmd: "PNR SEARCH", args: "<PNR>", desc: "Look up a booking", group: "LOOKUP" },
  { cmd: "PASSENGER SEARCH", args: "<TEXT>", desc: "Universal passenger search", group: "LOOKUP" },
  { cmd: "FLIGHT STATUS", args: "<NUM>", desc: "Show flight status", group: "LOOKUP" },
  { cmd: "VERIFY", args: "<PAYLOAD>", desc: "Verify a document QR reference", group: "LOOKUP" },
  { cmd: "AUDIT", args: "<REF>", desc: "Show audit trail for a PNR/flight", group: "LOOKUP" },

  { cmd: "CHECKIN", args: "<PNR>", desc: "Check in a passenger", group: "PASSENGER" },
  { cmd: "SEAT", args: "<PNR> <SEAT>", desc: "Assign a seat", group: "PASSENGER" },
  { cmd: "BAGGAGE ADD", args: "<PNR> <KG>", desc: "Accept baggage, auto-calc excess", group: "PASSENGER" },
  { cmd: "BAGGAGE PAY", args: "<PNR>", desc: "Mark pending excess baggage paid", group: "PASSENGER" },
  { cmd: "VOUCHER ISSUE", args: "<PNR> [TYPE]", desc: "Issue a meal voucher", group: "PASSENGER" },
  { cmd: "LOUNGE ISSUE", args: "<PNR>", desc: "Issue a lounge pass", group: "PASSENGER" },
  { cmd: "BOARDING PASS", args: "<PNR>", desc: "Generate boarding pass", group: "PASSENGER" },
  { cmd: "BOARD", args: "<PNR>", desc: "Board a passenger", group: "PASSENGER" },
  { cmd: "UNDO BOARD", args: "<PNR>", desc: "Undo boarding", group: "PASSENGER" },
  { cmd: "NOSHOW", args: "<PNR>", desc: "Mark passenger no-show", group: "PASSENGER" },

  { cmd: "CHECKIN OPEN", args: "<NUM>", desc: "Open check-in for a flight", group: "FLIGHT" },
  { cmd: "CHECKIN CLOSE", args: "<NUM>", desc: "Close check-in for a flight", group: "FLIGHT" },
  { cmd: "BOARDING OPEN", args: "<NUM>", desc: "Open boarding for a flight", group: "FLIGHT" },
  { cmd: "BOARDING FINAL CALL", args: "<NUM>", desc: "Issue final call", group: "FLIGHT" },
  { cmd: "GATE ASSIGN", args: "<NUM> <GATE>", desc: "Assign a gate to a flight", group: "FLIGHT" },
  { cmd: "GATE CLOSE", args: "<NUM>", desc: "Close the gate", group: "FLIGHT" },
  { cmd: "FLIGHT DELAY", args: "<NUM> [MIN]", desc: "Delay a flight (default 15 min)", group: "FLIGHT" },
  { cmd: "FLIGHT CANCEL", args: "<NUM>", desc: "Cancel a flight", group: "FLIGHT" },
  { cmd: "FLIGHT DEPART", args: "<NUM>", desc: "Mark flight departed", group: "FLIGHT" },
  { cmd: "FLIGHT LAND", args: "<NUM>", desc: "Mark flight landed", group: "FLIGHT" },
  { cmd: "FLIGHT CLOSE", args: "<NUM>", desc: "Close flight & generate summary", group: "FLIGHT" },
  { cmd: "FLIGHT STATUS", args: "<NUM>", desc: "Show flight status", group: "FLIGHT" },
];

// De-duplicate (FLIGHT STATUS appears in both LOOKUP and FLIGHT above for grouping
// purposes) while keeping the first occurrence for suggestion matching.
const seen = new Set<string>();
export const UNIQUE_COMMANDS = COMMANDS.filter((c) => {
  const key = c.cmd + "|" + c.args;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

/** Commands matching what's typed so far, based on the fixed keyword prefix. */
export function suggestCommands(input: string): CommandSpec[] {
  const upper = input.trim().toUpperCase();
  if (!upper) return [];
  return UNIQUE_COMMANDS.filter((c) => c.cmd.startsWith(upper) && c.cmd !== upper).slice(0, 8);
}

/** The longest known command keyword that the input starts with, if any. */
export function matchedKeyword(input: string): string | null {
  const upper = input.toUpperCase();
  let best: string | null = null;
  for (const c of UNIQUE_COMMANDS) {
    if ((upper === c.cmd || upper.startsWith(c.cmd + " ")) && (!best || c.cmd.length > best.length)) {
      best = c.cmd;
    }
  }
  return best;
}
