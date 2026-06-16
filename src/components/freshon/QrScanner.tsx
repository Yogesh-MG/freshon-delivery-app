import { Html5Qrcode } from "html5-qrcode";
import { Keyboard, ScanLine, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Full-screen camera QR/barcode scanner used to read the handover QR printed on
 * each delivery bag. Falls back to manual entry if the camera is unavailable.
 */
export const QrScanner = ({
  title = "Scan handover QR",
  hint = "Point at the QR on the delivery bag",
  onScan,
  onCancel,
}: {
  title?: string;
  hint?: string;
  onScan: (text: string) => void;
  onCancel: () => void;
}) => {
  const regionId = useRef(`qr-region-${Math.round(performance.now())}`);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [manualValue, setManualValue] = useState("");

  useEffect(() => {
    if (manual) return;
    let cancelled = false;
    const scanner = new Html5Qrcode(regionId.current, { verbose: false });
    scannerRef.current = scanner;

    const handle = (text: string) => {
      if (handledRef.current) return;
      handledRef.current = true;
      scanner.stop().catch(() => undefined).finally(() => onScan(text));
    };

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => handle(decoded),
        () => undefined,
      )
      .catch(() => {
        if (!cancelled) setError("Camera unavailable. Enter the code manually.");
      });

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s && s.isScanning) s.stop().catch(() => undefined);
    };
  }, [manual, onScan]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-secondary/95 backdrop-blur-sm">
      <div className="flex items-center justify-between px-5 pt-6 text-primary-foreground">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent-glow">Pickup</div>
          <div className="text-lg font-extrabold">{title}</div>
        </div>
        <button onClick={onCancel} className="rounded-full bg-white/10 p-2" aria-label="Close scanner">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        {!manual ? (
          <>
            <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-3xl ring-2 ring-accent/70">
              <div id={regionId.current} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
              <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-dashed border-accent/80" />
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-primary-foreground/80">
              <ScanLine className="h-4 w-4 text-accent" /> {hint}
            </div>
            {error && <div className="mt-2 text-center text-sm text-accent-glow">{error}</div>}
            <button
              onClick={() => setManual(true)}
              className="mt-6 flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold text-primary-foreground"
            >
              <Keyboard className="h-4 w-4" /> Enter code manually
            </button>
          </>
        ) : (
          <div className="w-full max-w-xs space-y-3">
            <label className="text-sm font-semibold text-primary-foreground/90">Handover code</label>
            <input
              autoFocus
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder="D-XXXXXX-1"
              className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 font-mono text-lg text-primary-foreground outline-none ring-accent placeholder:text-primary-foreground/40 focus:ring-2"
            />
            <button
              disabled={!manualValue.trim()}
              onClick={() => onScan(manualValue.trim())}
              className="w-full rounded-2xl bg-gradient-amber px-5 py-3.5 text-sm font-bold text-accent-foreground shadow-glow-amber disabled:opacity-50"
            >
              Confirm code
            </button>
            <button onClick={() => setManual(false)} className="w-full py-2 text-sm font-semibold text-primary-foreground/70">
              Back to camera
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
