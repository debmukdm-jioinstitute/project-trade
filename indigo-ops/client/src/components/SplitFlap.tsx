import { useEffect, useRef, useState } from "react";

// Classic split-flap (Solari board) character wheel order — the physical
// flap board rotates forward through this sequence to reach the target
// character, never backward. Digits come first so a clock's every-second
// digit rollovers (e.g. "9" -> "0") stay cheap; letters only cost more for
// infrequently-changing text fields.
const WHEEL = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ .:/'-→";
const FLAP_MS = 45; // time per flap tick
const MIN_FLUTTER = 4; // every refresh flutters at least this many ticks, even if the char didn't change
// A forward-only wheel can need up to WHEEL.length-1 ticks for one character
// (e.g. wrapping through every letter). Left uncapped, a field that updates
// faster than that animation completes (the once-a-second clock digits, most
// notably) gets its animation cut off mid-flight, stranding a wrong
// intermediate character on screen permanently. Capping the tick count and
// taking bigger wheel strides per tick when the true distance is longer
// keeps every animation's wall-clock time bounded regardless of distance.
const MAX_TICKS = 10;

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
    const distance = rawSteps === 0 ? MIN_FLUTTER : rawSteps;
    const ticks = Math.min(distance, MAX_TICKS);
    const stride = distance / ticks; // may be >1: take bigger wheel strides so long trips still finish in `ticks` steps

    let tick = 0;
    const kickoff = window.setTimeout(function step() {
      tick++;
      setFlapping(true);
      if (tick >= ticks) {
        setShown(target); // always land exactly on target, regardless of wheel rounding
      } else {
        const idx = (startIdx + Math.round(stride * tick)) % WHEEL.length;
        setShown(WHEEL[idx]);
      }
      if (tick < ticks) {
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
