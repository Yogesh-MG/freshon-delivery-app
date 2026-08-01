import { Stop } from "@/lib/types";
import { openInGoogleMaps } from "@/lib/mapApps";
import { dialPhone } from "@/lib/contact";
import { Camera, CheckCircle2, KeyRound, Navigation, Phone, ScanLine, Wallet, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CameraCapture } from "./CameraCapture";

/**
 * A drop-off needs BOTH proofs, captured in order: the photo evidences what was
 * left at the door, the OTP evidences the customer took it. Neither alone
 * settles a dispute, so `photo` and `otp` are steps in one chain, not a choice.
 */
type Mode = "details" | "photo" | "otp" | "done";

/**
 * Delivery-complete mark: the ring sweeps closed, then the tick strokes in.
 * Both paths declare pathLength="1" so `.draw-stroke` draws them regardless of
 * their real geometry.
 */
const SuccessCheck = () => (
  <div className="relative grid h-24 w-24 place-items-center">
    <div className="absolute inset-0 rounded-full bg-primary-soft animate-pop-in" />
    <svg viewBox="0 0 64 64" fill="none" className="relative h-20 w-20">
      <circle
        cx="32"
        cy="32"
        r="26"
        pathLength="1"
        stroke="hsl(var(--primary))"
        strokeWidth="4"
        strokeLinecap="round"
        className="draw-stroke"
        // Start the sweep at 12 o'clock rather than 3.
        style={{ transform: "rotate(-90deg)", transformOrigin: "32px 32px" }}
      />
      <path
        d="M20 33.5 L28.5 42 L45 24"
        pathLength="1"
        stroke="hsl(var(--primary))"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="draw-stroke"
        style={{ animationDelay: "0.32s" }}
      />
    </svg>
  </div>
);

/** Where the rider is in the two-step proof chain. */
const StepHeader = ({ step }: { step: 1 | 2 }) => (
  <div className="flex items-center gap-2">
    {([1, 2] as const).map((n) => (
      <div key={n} className="flex flex-1 items-center gap-1.5">
        <span
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-black ${
            n <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {n}
        </span>
        <span
          className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
            n === step ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {n === 1 ? "Photo" : "OTP"}
        </span>
        <span className={`h-0.5 flex-1 rounded-full ${n < step ? "bg-primary" : "bg-border"}`} />
      </div>
    ))}
  </div>
);

/**
 * Contact row for a drop-off. Riders who can't find the door need to call, and
 * the alternative is abandoning the stop. The number is resolved from the trip
 * payload if it carries one under any known key; the row falls back to a muted
 * unavailable state when it does not.
 */
const CustomerContact = ({ stop }: { stop: Stop }) => {
  const phone = stop.customer_phone?.trim();
  const name = stop.customer || "Customer";

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/60 px-4 py-3">
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Can't find the address?
        </div>
        <div className="truncate text-sm font-bold text-foreground">{name}</div>
        <div className="truncate text-xs text-muted-foreground">{phone || "Number not shared yet"}</div>
      </div>
      {phone ? (
        <button
          type="button"
          onClick={() => dialPhone(phone)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-primary px-3.5 py-2.5 text-xs font-bold text-primary-foreground shadow-glow-primary"
        >
          <Phone className="h-3.5 w-3.5" /> Call
        </button>
      ) : (
        <span className="flex shrink-0 items-center gap-1.5 rounded-xl bg-muted px-3.5 py-2.5 text-xs font-bold text-muted-foreground">
          <Phone className="h-3.5 w-3.5" /> Call
        </span>
      )}
    </div>
  );
};

export const ProofDrawer = ({
  stop,
  onClose,
  onComplete,
  onResend,
}: {
  stop: Stop | null;
  onClose: () => void;
  onComplete: (
    stop: Stop,
    proof: { type: "otp" | "photo"; otpCode?: string; photo?: File; codCollected?: boolean },
  ) => Promise<boolean>;
  onResend?: (stop: Stop) => Promise<void>;
}) => {
  const [mode, setMode] = useState<Mode>("details");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [cod, setCod] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  // Held with its preview URL so step 2 can show what was actually captured.
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [confetti, setConfetti] = useState<{ id: number; x: number; r: number; d: number; c: string }[]>([]);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const replacePhoto = (next: { file: File; url: string } | null) => {
    setPhoto((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return next;
    });
  };

  useEffect(() => {
    if (stop) {
      setMode("details");
      setOtp(["", "", "", "", "", ""]);
      setCod(false);
      replacePhoto(null);
    }
  }, [stop?.id]);

  const resend = async () => {
    if (!stop || !onResend) return;
    setResending(true);
    await onResend(stop);
    setResending(false);
  };

  const otpFilled = otp.every((d) => d !== "");

  /**
   * Sent as `type: "otp"` because that is what the delivery endpoint accepts —
   * the photo rides along and is uploaded to /proof/ before the call. Widen this
   * once the backend can record both.
   */
  const finish = async (proof: { type: "otp" | "photo"; otpCode?: string; photo?: File; codCollected?: boolean }) => {
    if (!stop) return;
    setBusy(true);
    const ok = await onComplete(stop, proof);
    setBusy(false);
    if (!ok) return;

    setMode("done");
    const colors = ["hsl(142 72% 35%)", "hsl(38 92% 55%)", "hsl(142 65% 50%)", "hsl(28 95% 60%)"];
    setConfetti(
      Array.from({ length: 36 }).map((_, i) => ({
        id: i,
        x: 50 + (Math.random() - 0.5) * 80,
        r: Math.random() * 360,
        d: Math.random() * 0.4,
        c: colors[i % colors.length],
      }))
    );
  };

  if (!stop) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog">
      <div className="absolute inset-0 bg-secondary/40 backdrop-blur-sm animate-fade-up" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-t-[28px] bg-card shadow-elevated animate-slide-up">
        <div className="flex justify-center pt-3"><div className="h-1.5 w-12 rounded-full bg-border" /></div>
        <div className="flex items-start justify-between px-5 pt-2">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{stop.type === "pickup" ? "Pickup · Hub" : "Drop-off"}</div>
            <div className="text-xl font-extrabold text-foreground">{stop.label}</div>
            <div className="text-xs text-muted-foreground">{stop.address}</div>
            {stop.latitude != null && stop.longitude != null && (
              <button
                type="button"
                onClick={() => openInGoogleMaps({ destination: { lat: stop.latitude!, lng: stop.longitude! } })}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-primary-soft px-3 py-1.5 text-xs font-bold text-primary"
              >
                <Navigation className="h-3.5 w-3.5" />
                Navigate to {stop.type === "pickup" ? "hub" : "drop-off"}
              </button>
            )}
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 pb-safe-6 pt-4 no-scrollbar">
          {mode === "details" && (
            <div className="space-y-4">
              <div>
                <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Parcel</div>
                <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2 text-sm">
                  <div className="flex flex-col">
                    {stop.order_id && (
                      <span className="font-semibold text-foreground">Order {stop.order_id}</span>
                    )}
                    <span className="text-muted-foreground">
                      {stop.parcel_count ? `${stop.parcel_count} bag${stop.parcel_count > 1 ? "s" : ""}` : "Parcel"}
                    </span>
                  </div>
                  <span className="font-semibold text-foreground">
                    {stop.weight_kg != null ? `${stop.weight_kg} kg` : "—"}
                  </span>
                </div>
                {stop.customer_phone && (
                  <a
                    href={`tel:${stop.customer_phone}`}
                    className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-bold text-primary"
                  >
                    <Phone className="h-4 w-4" />
                    Call {stop.customer || "customer"}
                  </a>
                )}
              </div>
              {stop.notes && (
                <div className="rounded-2xl border border-dashed border-primary/40 bg-primary-soft p-3 text-sm text-secondary">
                  <span className="font-bold text-primary">Customer note: </span>{stop.notes}
                </div>
              )}
              {stop.type === "dropoff" && <CustomerContact stop={stop} />}
              {stop.type === "dropoff" ? (
                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => setMode("photo")}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-glow-primary"
                  >
                    <Camera className="h-4 w-4" /> Start proof of delivery
                  </button>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <Camera className="h-3.5 w-3.5" /> Photo
                    <span className="opacity-50">→</span>
                    <KeyRound className="h-3.5 w-3.5" /> OTP
                    <span className="opacity-70">· both required</span>
                  </div>
                </div>
              ) : (
                <button onClick={() => finish({ type: "photo" })} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-amber px-5 py-3.5 text-sm font-bold text-accent-foreground shadow-glow-amber disabled:opacity-50">
                  <ScanLine className="h-4 w-4" /> Scan handover QR
                </button>
              )}
            </div>
          )}

          {mode === "otp" && (
            <div className="space-y-4 py-2">
              <StepHeader step={2} />
              {photo && (
                <div className="flex items-center gap-3 rounded-2xl bg-muted/60 p-2 pr-4">
                  <img src={photo.url} alt="Captured proof" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Photo captured
                    </div>
                    <div className="text-xs text-muted-foreground">Uploads when you complete this stop</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMode("photo")}
                    className="shrink-0 text-xs font-bold text-primary hover:underline"
                  >
                    Retake
                  </button>
                </div>
              )}
              <div className="text-center">
                <div className="text-sm font-bold text-foreground">Enter the 6-digit code</div>
                <div className="text-xs text-muted-foreground">Sent to the customer via SMS at pickup</div>
              </div>
              <div className="flex justify-center gap-2">
                {otp.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => (refs.current[i] = el)}
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 1);
                      const next = [...otp]; next[i] = v; setOtp(next);
                      if (v && i < 5) refs.current[i + 1]?.focus();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !otp[i] && i > 0) refs.current[i - 1]?.focus();
                    }}
                    // The sheet itself is bg-card, so a bg-card box with a
                    // hairline border vanished into it. Filled + 2px border, and
                    // each box turns primary once it holds a digit.
                    className={`h-14 w-11 rounded-2xl border-2 text-center text-2xl font-extrabold text-foreground outline-none transition ${
                      d
                        ? "border-primary bg-primary-soft"
                        : "border-border bg-muted"
                    } focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/25`}
                  />
                ))}
              </div>
              <label className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3 text-sm">
                <span className="flex items-center gap-2 font-semibold text-foreground"><Wallet className="h-4 w-4 text-primary" /> Cash on delivery collected</span>
                <input type="checkbox" checked={cod} onChange={(e) => setCod(e.target.checked)} className="h-5 w-5 accent-[hsl(var(--primary))]" />
              </label>
              <button
                disabled={!otpFilled || busy}
                onClick={() => finish({ type: "otp", otpCode: otp.join(""), photo: photo?.file, codCollected: cod })}
                className="w-full rounded-2xl bg-gradient-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-glow-primary transition disabled:opacity-50"
              >
                Verify &amp; Complete
              </button>
              {onResend && (
                <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
                  <span>Customer didn't get the code?</span>
                  <button
                    type="button"
                    onClick={resend}
                    disabled={resending}
                    className="font-bold text-primary hover:underline disabled:opacity-50"
                  >
                    {resending ? "Sending…" : "Resend code"}
                  </button>
                </div>
              )}
              {/* Both proofs are required, so the only way out of step 2 is
                  back to step 1 — never straight to complete. */}
              <button
                type="button"
                onClick={() => setMode("photo")}
                className="w-full py-1 text-xs font-semibold text-muted-foreground hover:underline"
              >
                Back to photo
              </button>
            </div>
          )}

          {/* mode === "photo" has no panel — step 1 is the full-screen
              CameraCapture overlay rendered below the drawer. */}

          {mode === "done" && (
            // Clipped: the pieces fall past the panel and would otherwise
            // stretch the drawer's scroll area.
            <div className="relative grid place-items-center overflow-hidden py-8">
              {confetti.map((c) => (
                <span
                  key={c.id}
                  className="absolute h-2.5 w-1 rounded-full animate-confetti"
                  style={{
                    left: `${c.x}%`, top: "38%", background: c.c,
                    animationDelay: `${c.d}s`,
                    "--r": `${c.r}deg`,
                  } as React.CSSProperties}
                />
              ))}
              <SuccessCheck />
              <div className="mt-4 text-lg font-extrabold text-foreground">Delivery complete</div>
              <div className="text-xs text-muted-foreground">Earnings will update after sync</div>
              <button onClick={onClose} className="mt-5 rounded-2xl bg-secondary px-6 py-3 text-sm font-bold text-secondary-foreground">
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Back to mission</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {mode === "photo" && (
        <CameraCapture
          title="Proof of delivery"
          hint={`Photograph the handover at ${stop.label}`}
          onCapture={(file) => {
            replacePhoto({ file, url: URL.createObjectURL(file) });
            setMode("otp");
          }}
          // Backing out returns to the stop, never forward — the photo is required.
          onCancel={() => setMode("details")}
        />
      )}
    </div>
  );
};
