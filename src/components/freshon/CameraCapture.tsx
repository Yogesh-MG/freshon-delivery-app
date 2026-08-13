import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, MapPin, RotateCcw, X } from "lucide-react";
import { isDemoMode } from "@/lib/demo/demoMode";
import { getCurrentCoords } from "@/lib/riderPosition";
import {
  buildProofStamp,
  encodeProof,
  finishFrame,
  grabFrame,
  proofFileName,
  proofMetaFrom,
  type ProofMeta,
} from "@/lib/proofImage";

/**
 * In-app camera for proof-of-delivery photos.
 *
 * Deliberately NOT `<input type="file" capture>`: that attribute is only a hint.
 * Desktop browsers ignore it outright and hand back a file picker, and plenty of
 * Android webviews still show a chooser that lets the rider pick an old shot
 * from the gallery. A photo that proves a delivery has to be taken AT the
 * delivery, so the frame is captured here from a live stream and there is no
 * path to the gallery at all.
 */
export const CameraCapture = ({
  title = "Proof of delivery",
  hint = "Frame the parcel at the door",
  onCapture,
  onCancel,
}: {
  title?: string;
  hint?: string;
  /** The encoded frame plus where and when it was taken. */
  onCapture: (file: File, meta: ProofMeta) => void;
  onCancel: () => void;
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // Held so the rider can judge the shot before it's committed.
  const [preview, setPreview] = useState<{ file: File; url: string; meta: ProofMeta } | null>(null);
  // Between the shutter and the encoded file there is a GPS read and a resize.
  // Short, but long enough that an unlabelled frozen screen reads as a crash.
  const [processing, setProcessing] = useState(false);
  const demo = isDemoMode();

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setReady(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This device has no camera the app can use.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setReady(true);
    } catch {
      setError("Camera blocked. Allow camera access to complete this delivery.");
    }
  }, []);

  useEffect(() => {
    if (preview) return;
    void start();
    return stop;
  }, [start, stop, preview]);

  // Revoke the object URL only once the preview is actually replaced/dropped.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  /**
   * Shutter. The frame is frozen synchronously and only then annotated: reading
   * the GPS first would sample the scene up to five seconds after the rider
   * tapped, which is a different photo than the one they framed.
   */
  const shoot = async () => {
    const video = videoRef.current;
    if (!video || processing) return;

    const frame = grabFrame(video);
    if (!frame) {
      setError("Couldn't capture the frame — try again.");
      return;
    }
    // The pixels are safe on the canvas now, so the stream can be released
    // while the fix is still coming in.
    stop();
    setProcessing(true);

    const meta = proofMetaFrom(await getCurrentCoords());
    const blob = await encodeProof(finishFrame(frame, meta));
    setProcessing(false);

    if (!blob) {
      setError("Couldn't save the photo — try again.");
      return;
    }
    const file = new File([blob], proofFileName(meta.capturedAt), { type: "image/jpeg" });
    setPreview({ file, url: URL.createObjectURL(file), meta });
  };

  /** Demo mode usually runs on a machine with no usable rear camera. */
  const shootDemo = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#14532d";
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 34px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("DEMO PROOF PHOTO", 320, 250);
    }
    stop();
    setProcessing(true);
    const meta = proofMetaFrom(await getCurrentCoords());
    const blob = await encodeProof(finishFrame(canvas, meta));
    setProcessing(false);
    if (!blob) return;
    const file = new File([blob], proofFileName(meta.capturedAt), { type: "image/jpeg" });
    setPreview({ file, url: URL.createObjectURL(file), meta });
  };

  const retake = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-secondary/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-5 pt-6 text-primary-foreground">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-glow">Step 1 of 2</div>
          <div className="text-lg font-extrabold">{title}</div>
        </div>
        <button onClick={() => { stop(); onCancel(); }} className="rounded-full bg-white/10 p-2" aria-label="Close camera">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="relative aspect-[3/4] w-full max-w-xs overflow-hidden rounded-3xl bg-black ring-2 ring-accent/70">
          {preview ? (
            <img src={preview.url} alt="Captured proof" className="h-full w-full object-cover" />
          ) : (
            <>
              <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
              {(!ready || processing) && !error && (
                <div className="absolute inset-0 grid place-items-center bg-black/40">
                  <Loader2 className="h-7 w-7 animate-spin text-accent" />
                </div>
              )}
            </>
          )}
          <div className="pointer-events-none absolute inset-5 rounded-2xl border-2 border-dashed border-accent/60" />
        </div>

        <div className="mt-4 text-center text-sm text-primary-foreground/80">
          {processing
            ? "Stamping the time and place…"
            : preview
            ? "Clear enough? This is what the customer's proof will show."
            : hint}
        </div>

        {/* What was stamped into the frame, repeated in text so the rider can
            see it landed without squinting at the thumbnail. */}
        {preview && (
          <div className="mt-2 flex max-w-xs items-center gap-1.5 text-center text-[11px] text-primary-foreground/70">
            <MapPin className="h-3 w-3 shrink-0" />
            <span>{buildProofStamp(preview.meta).join(" · ")}</span>
          </div>
        )}

        {error && <div className="mt-2 max-w-xs text-center text-sm text-accent-glow">{error}</div>}

        <div className="mt-6 w-full max-w-xs space-y-2">
          {preview ? (
            <>
              <button
                onClick={() => onCapture(preview.file, preview.meta)}
                className="w-full rounded-2xl bg-accent px-5 py-3.5 text-sm font-bold text-accent-foreground"
              >
                Use this photo
              </button>
              <button
                onClick={retake}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold text-primary-foreground"
              >
                <RotateCcw className="h-4 w-4" /> Retake
              </button>
            </>
          ) : error ? (
            <button
              onClick={() => (demo ? void shootDemo() : void start())}
              className="w-full rounded-2xl bg-white/10 px-5 py-3.5 text-sm font-bold text-primary-foreground"
            >
              {demo ? "Use a demo photo" : "Try camera again"}
            </button>
          ) : (
            <>
              <button
                onClick={() => void shoot()}
                disabled={!ready || processing}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-sm font-bold text-accent-foreground disabled:opacity-50"
              >
                <Camera className="h-4 w-4" /> {processing ? "Saving…" : "Take photo"}
              </button>
              {demo && (
                <button
                  onClick={() => void shootDemo()}
                  className="w-full rounded-2xl bg-white/10 px-4 py-2.5 text-xs font-bold text-primary-foreground/80"
                >
                  Simulate photo (demo)
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
