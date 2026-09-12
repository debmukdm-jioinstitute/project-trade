import { useEffect, useRef, useState } from "react";

// Classic split-flap (Solari board) character wheel order — the physical
// flap board rotates forward through this sequence to reach the target
// character, never backward, which is why "N" -> "A" takes a full lap.
const WHEEL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .:/'-→";
const FLAP_MS = 45; // time per flap tick
const MIN_FLUTTER = 4; // every refresh flutters at least this many ticks, even if the char didn't change

function wheelIndex(ch: string): number {
  const i = WHEEL.indexOf(ch.toUpperCase());
  return i === -1 ? WHEEL.indexOf(" ") : i;
}

/**
 * One character tile. Animates forward through the wheel from whatever is
 * currently displayed to `target` whenever `target` or `refreshKey` changes.
 */
function Flap({ target, refreshKey, delay }: { target: string; refreshKey: number; delay: number }) {
  const [shown, setShown] = useState(target);
  const [flapping, setFlapping] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    const startIdx = wheelIndex(shown);
    const endIdx = wheelIndex(target);
    const rawSteps = endIdx >= startIdx ? endIdx - startIdx : WHEEL.length - startIdx + endIdx;
    const steps = Math.max(rawSteps, rawSteps === 0 ? MIN_FLUTTER : rawSteps);

    let tick = 0;
    const kickoff = window.setTimeout(function step() {
      tick++;
      setFlapping(true);
      const idx = (startIdx + tick) % WHEEL.length;
      setShown(tick >= steps ? target : WHEEL[idx]);
      if (tick < steps) {
        timers.current.push(window.setTimeout(step, FLAP_MS));
      } else {
        window.setTimeout(() => setFlapping(false), FLAP_MS);
      }
    }, delay);
    timers.current.push(kickoff);

    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, refreshKey, delay]);

  return <span className={`fids-flap ${flapping ? "fids-flap-active" : ""}`}>{shown}</span>;
}

/**
 * A row of split-flap character tiles. Pass a fixed `width` to pad/truncate
 * (real boards are fixed-width per field); omit it for free-length text.
 * Bump `refreshKey` on every periodic poll to make the whole board flutter
 * like a real Solari board re-syncing, even when nothing actually changed.
 */
export function SplitFlapText({
  text,
  width,
  refreshKey,
  size = "md",
  className = "",
}: {
  text: string;
  width?: number;
  refreshKey: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const padded = (width ? text.toUpperCase().padEnd(width).slice(0, width) : text.toUpperCase()).split("");
  const sizeClass = size === "lg" ? "fids-flap-lg" : size === "sm" ? "fids-flap-sm" : "";

  return (
    <span className={`inline-flex ${sizeClass} ${className}`}>
      {padded.map((c, i) => (
        <Flap key={i} target={c} refreshKey={refreshKey} delay={i * 35} />
      ))}
    </span>
  );
}
