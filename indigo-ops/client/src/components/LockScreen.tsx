import { useCallback, useEffect, useState } from "react";
import { FaceScan } from "./FaceLock";
import { hasEnrolledFace } from "../lib/faceAuth";

const DEFAULT_CODE = "0000";
const SESSION_KEY = "ops_unlocked";

export function isUnlocked(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function lockSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* private-browsing / storage disabled — nothing to clear */
  }
}

function unlockSession(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* ignore — unlock still works for this render, just won't persist */
  }
}

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState("");
  const [shake, setShake] = useState(false);
  const [mode, setMode] = useState<"pin" | "face">(hasEnrolledFace() ? "face" : "pin");

  const onFaceMatch = useCallback(() => {
    unlockSession();
    onUnlock();
  }, [onUnlock]);

  function submit(finalCode: string) {
    if (finalCode === DEFAULT_CODE) {
      unlockSession();
      onUnlock();
    } else {
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setCode("");
      }, 500);
    }
  }

  function press(d: string) {
    if (code.length >= 4) return;
    const next = code + d;
    setCode(next);
    if (next.length === 4) setTimeout(() => submit(next), 120);
  }

  useEffect(() => {
    if (mode !== "pin") return;
    function onKey(e: KeyboardEvent) {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setCode((c) => c.slice(0, -1));
      else if (e.key === "Enter") submit(code);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, mode]);

  const faceEnrolled = hasEnrolledFace();

  return (
    <div className="fixed inset-0 z-[300] bg-ops-bg flex items-center justify-center">
      <div className={`panel w-[380px] p-6 text-center ${shake ? "animate-pulse" : ""}`}>
        <div className="text-ops-indigoBright font-bold tracking-widest text-lg">INDIGO OPS</div>
        <div className="text-ops-dim text-[11px] tracking-widest mt-1 mb-4">ACCESS LOCKED</div>

        {faceEnrolled && (
          <div className="flex border-b border-ops-border mb-4">
            <button
              onClick={() => setMode("face")}
              className={`flex-1 py-1.5 text-[11px] tracking-wide border-b-2 ${
                mode === "face" ? "border-ops-indigoBright text-ops-indigoBright" : "border-transparent text-ops-dim"
              }`}
            >
              FACE ID
            </button>
            <button
              onClick={() => setMode("pin")}
              className={`flex-1 py-1.5 text-[11px] tracking-wide border-b-2 ${
                mode === "pin" ? "border-ops-indigoBright text-ops-indigoBright" : "border-transparent text-ops-dim"
              }`}
            >
              PIN CODE
            </button>
          </div>
        )}

        {mode === "face" && faceEnrolled ? (
          <FaceScan onMatch={onFaceMatch} />
        ) : (
          <>
            <div className="text-ops-dim text-[11px] tracking-widest mb-6">ENTER CODE TO CONTINUE</div>
            <div className="flex justify-center gap-3 mb-6">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`w-4 h-4 rounded-full border ${
                    i < code.length ? "bg-ops-indigoBright border-ops-indigoBright" : "border-ops-border2"
                  } ${shake ? "border-ops-red" : ""}`}
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button key={d} className="btn text-base py-3" onClick={() => press(d)}>
                  {d}
                </button>
              ))}
              <button className="btn text-base py-3" onClick={() => setCode("")}>
                CLR
              </button>
              <button className="btn text-base py-3" onClick={() => press("0")}>
                0
              </button>
              <button className="btn text-base py-3" onClick={() => setCode((c) => c.slice(0, -1))}>
                ⌫
              </button>
            </div>
          </>
        )}

        <div className="text-[10px] text-ops-amber border-t border-ops-border pt-3 mt-2 leading-relaxed">
          PROTOTYPE LOCK ONLY — NOT REAL ACCESS CONTROL
          <br />
          Demo PIN: <span className="text-ops-text font-semibold">0000</span>
          {faceEnrolled && <> · Face ID uses a locally-stored reference photo — nothing leaves this browser.</>}
        </div>
      </div>
    </div>
  );
}
