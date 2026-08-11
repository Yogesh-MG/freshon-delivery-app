import type { RiderPosition } from "./riderPosition";

/**
 * Proof-of-delivery image processing.
 *
 * Two problems are solved here, both of them the rider's:
 *
 * 1. **Size.** A raw frame off a modern phone camera is 4000×3000 and encodes
 *    to 3–6 MB. That is uploaded at the customer's door, on the rider's own
 *    mobile data, in whatever signal the stairwell has. Proof of delivery has
 *    to be legible, not archival, so the frame is fitted inside a 1280 px box
 *    and encoded at quality 0.72 — around 150–250 KB, a twentieth of the cost.
 *
 * 2. **Provenance.** A canvas capture carries no EXIF at all: no timestamp, no
 *    GPS, no device. Without them the photo proves a parcel existed somewhere,
 *    at some point — which settles no dispute. The when and where are stamped
 *    into the pixels and also sent as form fields, so the claim survives being
 *    forwarded as a bare JPEG.
 *
 * The stamp is not a security control. A determined rider can photograph a
 * parcel anywhere; the proximity gate and the server's geofence are what make
 * that hard. It is there so an honest photo carries its own context.
 */

/** Longest edge of an uploaded proof, in pixels. */
export const MAX_PROOF_EDGE_PX = 1280;

/** JPEG quality for the encoded proof. */
export const PROOF_JPEG_QUALITY = 0.72;

export interface ProofMeta {
  /** ISO-8601, taken at the moment of capture. */
  capturedAt: string;
  latitude?: number;
  longitude?: number;
  /** Horizontal accuracy in metres, when the device reported one. */
  accuracy?: number | null;
}

/**
 * Scale a frame down to fit inside `maxEdge`, preserving aspect ratio. Never
 * scales up — a small frame from a weak camera is left exactly as it is rather
 * than being interpolated into a blurrier, larger file.
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge = MAX_PROOF_EDGE_PX,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest === 0) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** "11 Aug 2026, 2:32 pm" — local time, because the rider and the dispute are local. */
function formatStampTime(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The two lines burned into the photo. Coordinates are printed to five decimals
 * — roughly a metre, past which the digits are noise from the fix itself.
 */
export function buildProofStamp(meta: ProofMeta): string[] {
  const when = formatStampTime(meta.capturedAt);
  if (meta.latitude == null || meta.longitude == null) {
    return [when, "Location unavailable"];
  }
  const accuracy = meta.accuracy != null ? ` · ±${Math.round(meta.accuracy)} m` : "";
  return [when, `${meta.latitude.toFixed(5)}, ${meta.longitude.toFixed(5)}${accuracy}`];
}

/**
 * Draw the stamp into the bottom-left of an already-rendered canvas.
 *
 * Sized off the canvas width so it reads the same on any device, and laid on a
 * translucent bar because white-on-white is exactly what a doorstep photo is.
 */
export function drawProofStamp(canvas: HTMLCanvasElement, lines: string[]): void {
  const ctx = canvas.getContext("2d");
  if (!ctx || lines.length === 0) return;

  const fontPx = Math.max(11, Math.round(canvas.width * 0.028));
  const padding = Math.round(fontPx * 0.6);
  const lineHeight = Math.round(fontPx * 1.32);
  const barHeight = lineHeight * lines.length + padding * 2;

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${fontPx}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = "top";
  lines.forEach((line, i) => {
    ctx.fillText(line, padding, canvas.height - barHeight + padding + i * lineHeight);
  });
  ctx.restore();
}

/**
 * Freeze the current video frame at its native resolution.
 *
 * Kept separate from downscaling and stamping because those need the rider's
 * position, which is asynchronous — the pixels have to be captured the instant
 * the shutter is tapped, not a second later once the GPS answers.
 */
export function grabFrame(video: HTMLVideoElement): HTMLCanvasElement | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0);
  return canvas;
}

/** Downscale a frozen frame and burn its provenance stamp in. */
export function finishFrame(frame: HTMLCanvasElement, meta: ProofMeta): HTMLCanvasElement {
  const { width, height } = fitWithin(frame.width, frame.height);
  if (width === frame.width && height === frame.height) {
    drawProofStamp(frame, buildProofStamp(meta));
    return frame;
  }

  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) return frame;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(frame, 0, 0, width, height);
  drawProofStamp(out, buildProofStamp(meta));
  return out;
}

/** Encode to JPEG. Resolves null when the browser refuses to produce a blob. */
export function encodeProof(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob !== "function") {
      resolve(null);
      return;
    }
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", PROOF_JPEG_QUALITY);
  });
}

/**
 * File name carries the capture instant, so a proof pulled out of storage is
 * identifiable without reading the row it belongs to.
 */
export function proofFileName(capturedAt: string): string {
  return `proof-${capturedAt.replace(/[:.]/g, "-")}.jpg`;
}

/** Position → capture metadata, with the timestamp taken now. */
export function proofMetaFrom(position: RiderPosition | null): ProofMeta {
  return {
    capturedAt: new Date().toISOString(),
    latitude: position?.latitude,
    longitude: position?.longitude,
    accuracy: position?.accuracy ?? null,
  };
}
