import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, X } from "lucide-react";
import { isDemoMode } from "@/lib/demo/demoMode";

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
  onCapture: (file: File) => void;
  onCancel: () => void;
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  // Held so the rider can judge the shot before it's committed.
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
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

  const shoot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Couldn't capture the frame — try again.");
          return;
        }
        const file = new File([blob], `proof-${Date.now()}.jpg`, { type: "image/jpeg" });
        stop();
        setPreview({ file, url: URL.createObjectURL(file) });
      },
      "image/jpeg",
      0.85,
    );
  };

  /** Demo mode usually runs on a machine with no usable rear camera. */
  const shootDemo = () => {
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
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "demo-proof.jpg", { type: "image/jpeg" });
      stop();
      setPreview({ file, url: URL.createObjectURL(file) });
    }, "image/jpeg");
  };

  const retake = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-secondary/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-5 pt-6 text-primary-foreground">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent-glow">Step 1 of 2</div>
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
              {!ready && !error && (
                <div className="absolute inset-0 grid place-items-center">
                  <Loader2 className="h-7 w-7 animate-spin text-accent" />
                </div>
              )}
            </>
          )}
          <div className="pointer-events-none absolute inset-5 rounded-2xl border-2 border-dashed border-accent/60" />
        </div>

        <div className="mt-4 text-center text-sm text-primary-foreground/80">
          {preview ? "Clear enough? This is what the customer's proof will show." : hint}
        </div>
        {error && <div className="mt-2 max-w-xs text-center text-sm text-accent-glow">{error}</div>}

        <div className="mt-6 w-full max-w-xs space-y-2">
          {preview ? (
            <>
              <button
                onClick={() => onCapture(preview.file)}
                className="w-full rounded-2xl bg-gradient-amber px-5 py-3.5 text-sm font-bold text-accent-foreground shadow-glow-amber"
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
              onClick={demo ? shootDemo : () => void start()}
              className="w-full rounded-2xl bg-white/10 px-5 py-3.5 text-sm font-bold text-primary-foreground"
            >
              {demo ? "Use a demo photo" : "Try camera again"}
            </button>
          ) : (
            <>
              <button
                onClick={shoot}
                disabled={!ready}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-amber px-5 py-3.5 text-sm font-bold text-accent-foreground shadow-glow-amber disabled:opacity-50"
              >
                <Camera className="h-4 w-4" /> Take photo
              </button>
              {demo && (
                <button
                  onClick={shootDemo}
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
