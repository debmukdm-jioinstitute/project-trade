// Client-side face enrollment/match using face-api.js (TinyFaceDetector +
// 68-point landmarks + a 128-value face descriptor), entirely local — no
// image or descriptor ever leaves the browser. Model weights are served
// from /models (public/models). This is still a client-side-only gate, not
// a server-enforced security control — see LockScreen for the disclaimer.
import * as faceapi from "face-api.js";

const MODEL_URL = "/models";
const STORAGE_KEY = "ops_face_descriptor";

// face-api.js's own recommended threshold for its 128-d descriptor space:
// below this euclidean distance, two descriptors are considered the same
// person.
export const MATCH_THRESHOLD = 0.6;

let modelsLoaded = false;
let loadingPromise: Promise<void> | null = null;

export function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return Promise.resolve();
  if (loadingPromise) return loadingPromise;
  loadingPromise = Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
  ]).then(() => {
    modelsLoaded = true;
  });
  return loadingPromise;
}

export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

/** Detects the single most prominent face and returns its 128-d descriptor, or null if no face found. */
export async function detectFaceDescriptor(
  input: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<Float32Array | null> {
  const result = await faceapi
    .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return result?.descriptor ?? null;
}

export function euclideanDistance(a: Float32Array, b: Float32Array): number {
  return faceapi.euclideanDistance(a, b);
}

export function saveEnrolledDescriptor(descriptor: Float32Array): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(descriptor)));
}

export function getEnrolledDescriptor(): Float32Array | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    return new Float32Array(arr);
  } catch {
    return null;
  }
}

export function hasEnrolledFace(): boolean {
  return getEnrolledDescriptor() !== null;
}

export function clearEnrolledFace(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Loads an <img> element from a File (upload) or data/object URL, resolved once decoded. */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
