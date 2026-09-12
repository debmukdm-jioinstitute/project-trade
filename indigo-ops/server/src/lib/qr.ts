import QRCode from "qrcode";

// Generates an inline SVG QR code as a string. Payload is a simulated secure
// reference only (e.g. "6E|BP|A7K9PQ|001") — never encodes sensitive PII.
export async function qrSvg(payload: string): Promise<string> {
  return QRCode.toString(payload, { type: "svg", margin: 1, width: 160 });
}

// Simple deterministic pseudo-barcode (visual only, Code128-style bars) for
// printable documents. Not a real scannable barcode — this is a prototype.
export function barcodeSvg(payload: string, width = 260, height = 60): string {
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = (hash * 31 + payload.charCodeAt(i)) >>> 0;
  }
  const bars: string[] = [];
  let x = 4;
  let seed = hash || 1;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return (seed >>> 8) / 0xffffff;
  };
  while (x < width - 4) {
    const w = 1 + Math.floor(rand() * 3);
    if (rand() > 0.45) {
      bars.push(`<rect x="${x}" y="4" width="${w}" height="${height - 20}" fill="#0a0e17" />`);
    }
    x += w + 1;
  }
  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background:#fff">${bars.join(
    ""
  )}<text x="${width / 2}" y="${height - 4}" text-anchor="middle" font-family="monospace" font-size="10" fill="#0a0e17">${payload}</text></svg>`;
}
