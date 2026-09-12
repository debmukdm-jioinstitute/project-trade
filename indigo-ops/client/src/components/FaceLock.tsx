import { useEffect, useRef, useState } from "react";
import {
  loadFaceModels,
  detectFaceDescriptor,
  euclideanDistance,
  saveEnrolledDescriptor,
  getEnrolledDescriptor,
  hasEnrolledFace,
  clearEnrolledFace,
  loadImageFromFile,
  MATCH_THRESHOLD,
} from "../lib/faceAuth";

/** Enroll a reference face — upload a photo or capture one from the camera. Shown while unlocked (e.g. header "ENROLL FACE"). */
export function FaceEnroll({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [enrolled, setEnrolled] = useState(hasEnrolledFace());
  const [preview, setPreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => {
    loadFaceModels().catch(() => setStatus("FAILED TO LOAD FACE MODELS — CHECK /models IS SERVED"));
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      stopCamera();
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraOn(true);
      setStatus("");
    } catch {
      setStatus("CAMERA ACCESS DENIED OR UNAVAILABLE — USE UPLOAD INSTEAD");
    }
  }

  async function enrollFrom(source: HTMLImageElement | HTMLVideoElement) {
    setBusy(true);
    setStatus("DETECTING FACE...");
    try {
      await loadFaceModels();
      const descriptor = await detectFaceDescriptor(source);
      if (!descriptor) {
        setStatus("NO FACE DETECTED — TRY A CLEARER, FRONT-FACING PHOTO");
        return;
      }
      saveEnrolledDescriptor(descriptor);
      setEnrolled(true);
      setStatus("FACE ENROLLED — THIS FACE CAN NOW UNLOCK THE PORTAL");
      stopCamera();
    } catch (e) {
      setStatus(`ERROR: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = await loadImageFromFile(file);
    setPreview(img.src);
    await enrollFrom(img);
  }

  function captureFromCamera() {
    if (!videoRef.current) return;
    enrollFrom(videoRef.current);
  }

  function removeEnrolled() {
    clearEnrolledFace();
    setEnrolled(false);
    setPreview(null);
    setStatus("ENROLLED FACE REMOVED");
  }

  return (
    <div className="fixed inset-0 z-[250] bg-black/70 flex items-center justify-center" onMouseDown={onClose}>
      <div className="panel w-[440px] p-5 space-y-3" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-ops-indigoBright font-semibold tracking-wide">FACE ID ENROLLMENT</span>
          <button onClick={onClose} className="text-ops-dim hover:text-ops-text">
            [ESC] CLOSE
          </button>
        </div>

        <div className="text-[11px] text-ops-dim">
          Enroll a reference face so the LOCK screen can be opened with a face scan instead of the PIN. Stored only in
          this browser (localStorage) — never uploaded anywhere.
        </div>

        {enrolled && (
          <div className="badge badge-green">FACE CURRENTLY ENROLLED</div>
        )}

        <div className="flex gap-2">
          <label className="btn flex-1 text-center cursor-pointer">
            ⬆ UPLOAD PHOTO
            <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
          </label>
          {!cameraOn ? (
            <button className="btn flex-1" onClick={startCamera} disabled={busy}>
              📷 USE CAMERA
            </button>
          ) : (
            <button className="btn-primary btn flex-1" onClick={captureFromCamera} disabled={busy}>
              CAPTURE &amp; ENROLL
            </button>
          )}
        </div>

        {cameraOn && (
          <video ref={videoRef} autoPlay muted playsInline className="w-full rounded-sm bg-black" style={{ transform: "scaleX(-1)" }} />
        )}
        {preview && !cameraOn && <img src={preview} alt="enrolled preview" className="w-full rounded-sm" />}

        {status && <div className="text-[12px] text-ops-amber">{status}</div>}

        {enrolled && (
          <button className="btn-danger btn w-full" onClick={removeEnrolled}>
            REMOVE ENROLLED FACE
          </button>
        )}
      </div>
    </div>
  );
}

/** Live camera face-match used on the lock screen. Calls onMatch() when the scanned face matches the enrolled descriptor. */
export function FaceScan({ onMatch }: { onMatch: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState("INITIALIZING...");
  const [ready, setReady] = useState(false);
  const consecutiveMatches = useRef(0);
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;
    let interval: number | undefined;

    (async () => {
      try {
        setStatus("LOADING FACE MODELS...");
        await loadFaceModels();
        setStatus("REQUESTING CAMERA...");
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (stopped.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setReady(true);
        setStatus("POSITION YOUR FACE IN FRAME");

        interval = window.setInterval(async () => {
          if (!videoRef.current || stopped.current) return;
          const enrolled = getEnrolledDescriptor();
          if (!enrolled) {
            setStatus("NO FACE ENROLLED");
            return;
          }
          const descriptor = await detectFaceDescriptor(videoRef.current);
          if (!descriptor) {
            consecutiveMatches.current = 0;
            setStatus("NO FACE DETECTED");
            return;
          }
          const distance = euclideanDistance(descriptor, enrolled);
          if (distance < MATCH_THRESHOLD) {
            consecutiveMatches.current++;
            setStatus(`MATCH (${(1 - distance).toFixed(2)} confidence) — HOLD STILL`);
            if (consecutiveMatches.current >= 2) {
              setStatus("ACCESS GRANTED");
              stopped.current = true;
              if (interval) window.clearInterval(interval);
              streamRef.current?.getTracks().forEach((t) => t.stop());
              onMatch();
            }
          } else {
            consecutiveMatches.current = 0;
            setStatus("FACE NOT RECOGNIZED");
          }
        }, 500);
      } catch {
        setStatus("CAMERA ACCESS DENIED — USE PIN INSTEAD");
      }
    })();

    return () => {
      stopped.current = true;
      if (interval) window.clearInterval(interval);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onMatch]);

  return (
    <div className="space-y-3">
      <div className="relative w-full aspect-square max-w-[280px] mx-auto bg-black rounded-sm overflow-hidden">
        <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
        {!ready && <div className="absolute inset-0 flex items-center justify-center text-ops-dim text-[11px] p-4 text-center">{status}</div>}
      </div>
      <div className="text-center text-[12px] text-ops-amber">{status}</div>
    </div>
  );
}
