// Color-codes a line of OPS> terminal output for readability: section
// headings, command-reference rows (HELP), KEY: VALUE pairs, and audit-log
// rows all get distinct treatment instead of one flat gray.
import type { ReactNode } from "react";

function isHeadingLine(line: string): boolean {
  const t = line.trim();
  if (!t || /^\s/.test(line)) return false;
  if (t.includes(":")) return false; // KEY: VALUE lines are handled separately
  if (!/[A-Z]/.test(t)) return false;
  return t === t.toUpperCase();
}

const CMD_REF_RE = /^(\s{2})(\S.*?)(\s{2,})(\S.*)$/;
const KV_RE = /^([A-Z][A-Z0-9 /_-]*):\s(.*)$/;
const AUDIT_RE = /^(\d{2}:\d{2}:\d{2})(\s+)(\S+)(\s+)(.*)$/;

function withPlaceholders(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\[[^\]]*\]|<[^>]*>)/g).filter((p) => p !== "");
  return parts.map((tok, i) =>
    /^[<[]/.test(tok) ? (
      <span key={`${keyPrefix}-${i}`} className="text-ops-amber">
        {tok}
      </span>
    ) : (
      <span key={`${keyPrefix}-${i}`} className="text-ops-indigoBright font-semibold">
        {tok}
      </span>
    )
  );
}

export function renderTerminalLine(line: string, key: number): ReactNode {
  if (line.startsWith("ERROR")) {
    return (
      <div key={key} className="text-ops-red font-semibold">
        {line}
      </div>
    );
  }
  if (!line.trim()) {
    return <div key={key}> </div>;
  }

  const kv = line.match(KV_RE);
  if (kv) {
    const [, label, value] = kv;
    return (
      <div key={key}>
        <span className="text-ops-cyan">{label}:</span> <span className="text-ops-text font-medium">{value}</span>
      </div>
    );
  }

  const cmdRef = line.match(CMD_REF_RE);
  if (cmdRef) {
    const [, indent, cmdPart, gap, desc] = cmdRef;
    return (
      <div key={key}>
        {indent}
        {withPlaceholders(cmdPart, `c${key}`)}
        {gap}
        <span className="text-ops-dim">{desc}</span>
      </div>
    );
  }

  const audit = line.match(AUDIT_RE);
  if (audit) {
    const [, time, g1, category, g2, message] = audit;
    return (
      <div key={key}>
        <span className="text-ops-dim">{time}</span>
        {g1}
        <span className="badge badge-cyan">{category}</span>
        {g2}
        <span className="text-ops-text">{message}</span>
      </div>
    );
  }

  if (isHeadingLine(line)) {
    return (
      <div key={key} className="text-ops-cyan font-semibold mt-2 tracking-wide">
        {line}
      </div>
    );
  }

  return (
    <div key={key} className="text-ops-dim">
      {line}
    </div>
  );
}
