import { Stop } from "@/lib/types";
import { openInGoogleMaps } from "@/lib/mapApps";
import { dialPhone } from "@/lib/contact";
import { AlertTriangle, Camera, CheckCircle2, KeyRound, Loader2, LocateFixed, Lock, MapPin, Navigation, Phone, ScanLine, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CameraCapture } from "./CameraCapture";
import {
  formatDistance,
  PROOF_UNLOCK_RADIUS_M,
  type StopProximity,
} from "@/lib/stopProximity";
import type { ProofMeta } from "@/lib/proofImage";
import type { DeliveryException } from "@/lib/deliveryAssignmentService";
import { classifyDeliveryError, deliveryFailureHint, type DeliveryFailure } from "@/lib/deliveryErrors";
import { DELIVERY_RESEND_COOLDOWN_S, deliveryOtpKey, useOtpSession } from "@/lib/otpSession";

/**
 * A drop-off needs BOTH proofs, captured in order: the photo evidences what was
 * left at the door, the OTP evidences the customer took it. Neither alone
 * settles a dispute, so `photo` and `otp` are steps in one chain, not a choice.
 */
type Mode = "details" | "photo" | "otp" | "done";

/** Everything the drawer knows about one completed handover. */
export interface ProofSubmission {
  type: "otp" | "photo";
  otpCode?: string;
  photo?: File;
  /** When and where the photo was taken, for the upload's provenance fields. */
  photoMeta?: ProofMeta;
  /** Set only on the no-code path, saying why the OTP was not used. */
  exceptionReason?: DeliveryException | null;
}

/**
 * What `onComplete` reports back. A bare boolean still works — the drawer only
 * needs the richer form to tell a wrong code (clear the boxes, ask again) from
 * a geofence refusal (leave them alone, the rider has to walk).
 */
export type ProofOutcome = boolean | { ok: boolean; error?: string; failure?: DeliveryFailure };

/**
 * Failed code attempts before the no-code path is offered. Two is deliberate:
 * one failure is usually a misheard digit, and offering the exception that
 * early would make it the easy route rather than the last one.
 */
export const OTP_ATTEMPTS_BEFORE_EXCEPTION = 2;

const EMPTY_OTP = ["", "", "", "", "", ""];

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
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-black ${
            n <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {n}
        </span>
        <span
          className={`text-[11px] font-bold uppercase tracking-[0.14em] ${
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
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Can't find the address?
        </div>
        <div className="truncate text-sm font-bold text-foreground">{name}</div>
        <div className="truncate text-xs text-muted-foreground">{phone || "Number not shared yet"}</div>
      </div>
      {phone ? (
        <button
          type="button"
          onClick={() => dialPhone(phone)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2.5 text-xs font-bold text-primary-foreground shadow-glow-primary"
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

/**
 * Step 1 is not offered until the rider is at the drop. Until then this card
 * stands in its place with the live distance, so the reason the button is
 * missing is never a mystery — and the rider isn't told to walk when the real
 * problem is that no GPS fix has landed yet.
 */
const ProofLocked = ({
  proximity,
  onRefreshPosition,
}: {
  proximity: StopProximity;
  onRefreshPosition?: () => void | Promise<void>;
}) => {
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    if (!onRefreshPosition) return;
    setRefreshing(true);
    await onRefreshPosition();
    setRefreshing(false);
  };

  const away = proximity.distanceM != null ? formatDistance(proximity.distanceM) : null;

  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-border bg-muted/60 p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-card text-muted-foreground ring-1 ring-border">
          <Lock className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-bold text-foreground">
            {proximity.awaitingFix ? "Waiting for your location" : "Proof unlocks near the drop"}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {proximity.awaitingFix
              ? "Turn on location and try again — the photo and OTP steps need your position."
              : `Photo and OTP open within ${PROOF_UNLOCK_RADIUS_M} m of the address. Head over and this unlocks on its own.`}
          </div>
        </div>
      </div>

      {away && (
        <div className="flex items-center justify-between rounded-xl bg-card px-3 py-2 ring-1 ring-border">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> Distance to drop
          </span>
          <span className="text-sm font-extrabold tabular-nums text-foreground">{away}</span>
        </div>
      )}

      {onRefreshPosition && (
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-card py-2.5 text-xs font-bold text-foreground ring-1 ring-border disabled:opacity-60"
        >
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
          {refreshing ? "Checking location…" : "Refresh my location"}
        </button>
      )}
    </div>
  );
};

export const ProofDrawer = ({
  stop,
  onClose,
  onComplete,
  onResend,
  proximity,
  onRefreshPosition,
}: {
  stop: Stop | null;
  onClose: () => void;
  onComplete: (stop: Stop, proof: ProofSubmission) => Promise<ProofOutcome>;
  onResend?: (stop: Stop) => Promise<void>;
  /** Gate for this stop. Omitted (or unlocked) means the proof chain is open. */
  proximity?: StopProximity | null;
  /** Re-sample the rider's GPS, for the "waiting for a fix" case. */
  onRefreshPosition?: () => void | Promise<void>;
}) => {
  const [mode, setMode] = useState<Mode>("details");
  const [otp, setOtp] = useState(EMPTY_OTP);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  // Held with its preview URL so step 2 can show what was actually captured,
  // and with its metadata so the upload can say when and where it was taken.
  const [photo, setPhoto] = useState<{ file: File; url: string; meta: ProofMeta } | null>(null);
  const [confetti, setConfetti] = useState<{ id: number; x: number; r: number; d: number; c: string }[]>([]);
  /**
   * The last refusal, kept on screen. A toast is gone in four seconds and takes
   * the only explanation of a failed delivery with it.
   */
  const [failure, setFailure] = useState<{ message: string; kind: DeliveryFailure } | null>(null);
  // The no-code path asks twice: it closes a delivery the customer never
  // confirmed, and a mis-tap must not be able to do that.
  const [exceptionArmed, setExceptionArmed] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  /**
   * Held outside the component, keyed by stop. Closing the sheet to call the
   * customer used to reset the resend lock and the failed-attempt count, so a
   * rider could sidestep the cooldown by closing and reopening, and the no-code
   * fallback forgot the attempts that were supposed to unlock it.
   */
  const otpKey = stop?.type === "dropoff" ? deliveryOtpKey(stop.id) : null;
  const {
    remaining: cooldown,
    failures: attempts,
    resends,
    noteResend,
    noteFailure,
    clear: clearOtpSession,
  } = useOtpSession(otpKey);

  const replacePhoto = (next: { file: File; url: string; meta: ProofMeta } | null) => {
    setPhoto((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return next;
    });
  };

  const resetForStop = () => {
    setMode("details");
    setOtp(EMPTY_OTP);
    setFailure(null);
    setExceptionArmed(false);
    replacePhoto(null);
    // Note what is *not* reset here: the resend lock and the failed-attempt
    // count. Those belong to the code, not to this sheet, and `useOtpSession`
    // re-reads them for whichever stop is now open.
  };

  /**
   * Reset on the way in *and* on the way out. Only resetting when a stop
   * arrives left a closed drawer holding the previous rider's half-finished
   * proof — the captured File, its blob URL and the digits already typed — for
   * as long as the app ran without another stop being opened.
   */
  useEffect(() => {
    resetForStop();
    // Keyed on the stop alone: `resetForStop` is redefined every render, and
    // depending on it would wipe the rider's half-entered proof on each one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop?.id]);

  // Last line for the blob URL: unmount never runs the effect above.
  useEffect(() => () => replacePhoto(null), []);

  const resend = async () => {
    if (!stop || !onResend || resending || cooldown > 0) return;
    setResending(true);
    await onResend(stop);
    setResending(false);
    noteResend(DELIVERY_RESEND_COOLDOWN_S);
    // A fresh code makes the previous "wrong code" stale — clear it and the
    // boxes, so the rider is typing the new one into an empty field.
    setFailure(null);
    setOtp(EMPTY_OTP);
    refs.current[0]?.focus();
  };

  /**
   * Write digits into the boxes from `start` onwards.
   *
   * Handles a paste and an SMS autofill as well as single keystrokes: both
   * deliver the whole code into one input, and the old handler kept the first
   * character and dropped the rest, which read as the app ignoring the paste.
   */
  const writeOtp = (raw: string, start: number) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return;
    const next = [...otp];
    // A whole code lands at the start whichever box received it. Pasting six
    // digits into box 4 otherwise kept two and silently dropped four.
    const from = digits.length >= next.length ? 0 : start;
    for (let i = 0; i < digits.length && from + i < next.length; i++) {
      next[from + i] = digits[i];
    }
    setOtp(next);
    refs.current[Math.min(from + digits.length, next.length - 1)]?.focus();
  };

  const otpFilled = otp.every((d) => d !== "");

  /**
   * The no-code fallback. Withheld until the rider has actually tried, because
   * it closes a delivery on the photo alone — but it has to exist: a customer
   * whose phone is off, whose number is wrong, or who never got the SMS leaves
   * the rider holding a parcel with no way to record handing it over.
   */
  const exceptionAvailable = !!photo && (attempts >= OTP_ATTEMPTS_BEFORE_EXCEPTION || resends > 0);

  const finish = async (proof: ProofSubmission) => {
    if (!stop) return;
    setBusy(true);
    setFailure(null);
    const outcome = await onComplete(stop, proof);
    setBusy(false);

    const detail = typeof outcome === "object" && outcome !== null ? outcome : null;
    const ok = outcome === true || detail?.ok === true;
    if (!ok) {
      // A bare `false` means the caller took the flow over rather than failing
      // — a hub pickup hands off to the QR scanner this way. Only a detailed
      // outcome describes something that actually went wrong.
      if (!detail) return;

      const message = detail.error || "Couldn't complete this stop. Try again.";
      const kind = detail?.failure ?? classifyDeliveryError(message);
      setFailure({ message, kind });
      // Only a rejected *code* counts as an attempt. A geofence or network
      // refusal says nothing about whether the customer can read out a code,
      // so it must not push the rider towards the no-code fallback.
      if (proof.type === "otp" && kind === "otp") {
        noteFailure();
        // …and only a rejected code is worth retyping.
        setOtp(EMPTY_OTP);
        refs.current[0]?.focus();
      }
      return;
    }

    // Delivered: this code is spent, so its cooldown and attempt history go
    // with it rather than lingering against a stop id that may be reused.
    clearOtpSession();
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

  /**
   * Only drop-offs are gated — a hub pickup is settled by the handover QR, and
   * the rider is standing at the hub to scan it anyway. `mode` is untouched by
   * the gate: a chain that has already started is allowed to finish even if the
   * fix wanders, because backing a rider out mid-capture loses the photo.
   */
  const proofLocked = stop?.type === "dropoff" && !!proximity && !proximity.unlocked;

  if (!stop) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog">
      <div className="absolute inset-0 bg-secondary/40 backdrop-blur-sm animate-fade-up" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-t-[28px] bg-card shadow-elevated animate-slide-up">
        <div className="flex justify-center pt-3"><div className="h-1.5 w-12 rounded-full bg-border" /></div>
        <div className="flex items-start justify-between px-5 pt-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{stop.type === "pickup" ? "Pickup · Hub" : "Drop-off"}</div>
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
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-muted tap-target" aria-label="Close">
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
              </div>
              {stop.notes && (
                <div className="rounded-2xl border border-dashed border-primary/40 bg-primary-soft p-3 text-sm text-foreground">
                  <span className="font-bold text-primary">Customer note: </span>{stop.notes}
                </div>
              )}
              {stop.type === "dropoff" && <CustomerContact stop={stop} />}
              {stop.type === "dropoff" ? (
                proofLocked ? (
                  // Details, notes and the Call/Navigate rows above stay
                  // available the whole way there — only the proof chain waits.
                  <ProofLocked proximity={proximity!} onRefreshPosition={onRefreshPosition} />
                ) : (
                <div className="space-y-2 pt-1">
                  {proximity?.arrived && (
                    <div className="flex items-center justify-center gap-1.5 rounded-xl bg-primary-soft py-2 text-xs font-bold text-primary">
                      <MapPin className="h-3.5 w-3.5" /> You've arrived
                      {proximity.distanceM != null && ` · ${formatDistance(proximity.distanceM)} away`}
                    </div>
                  )}
                  <button
                    onClick={() => setMode("photo")}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-glow-primary"
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
                )
              ) : (
                <button onClick={() => finish({ type: "photo" })} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3.5 text-sm font-bold text-accent-foreground shadow-glow-amber disabled:opacity-50">
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
                    // `maxLength` caps typing, not a paste or an autofill — both
                    // arrive as the whole code in one box and are spread out
                    // across the row from here.
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      if (raw.length > 1) {
                        writeOtp(raw, i);
                        return;
                      }
                      const next = [...otp]; next[i] = raw; setOtp(next);
                      if (raw && i < 5) refs.current[i + 1]?.focus();
                    }}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData("text");
                      if (!/\d/.test(pasted)) return;
                      e.preventDefault();
                      writeOtp(pasted, i);
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
              {/* The last refusal, and what to do about it. Persistent, unlike
                  the toast that used to be the only account of a failure. */}
              {failure && (
                <div className="flex items-start gap-2.5 rounded-2xl bg-destructive/10 px-4 py-3 text-left">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-destructive">{failure.message}</div>
                    {deliveryFailureHint(failure.kind) && (
                      <div className="mt-0.5 text-xs text-destructive/80">{deliveryFailureHint(failure.kind)}</div>
                    )}
                  </div>
                </div>
              )}

              <button
                disabled={!otpFilled || busy}
                onClick={() =>
                  finish({
                    type: "otp",
                    otpCode: otp.join(""),
                    photo: photo?.file,
                    photoMeta: photo?.meta,
                  })
                }
                className="w-full rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-glow-primary transition disabled:opacity-50"
              >
                {busy ? "Verifying…" : "Verify & Complete"}
              </button>
              {onResend && (
                <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
                  <span>Customer didn't get the code?</span>
                  <button
                    type="button"
                    onClick={resend}
                    // Locked out for a spell after each send: every tap costs an
                    // SMS, and a rate-limited gateway refuses the one that
                    // would have worked.
                    disabled={resending || cooldown > 0}
                    className="font-bold text-primary hover:underline disabled:opacity-50 disabled:no-underline"
                  >
                    {resending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                  </button>
                </div>
              )}

              {/* The way out when the code cannot be had at all. Appears only
                  once the rider has tried, and closes the stop on the photo
                  alone — flagged, so operations can see it was not a normal
                  handover. */}
              {exceptionAvailable && (
                <div className="rounded-2xl border border-dashed border-accent/50 bg-accent/5 p-3">
                  {!exceptionArmed ? (
                    <button
                      type="button"
                      onClick={() => setExceptionArmed(true)}
                      className="w-full text-xs font-bold text-accent hover:underline"
                    >
                      Customer can't receive the code
                    </button>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="text-xs text-muted-foreground">
                        This closes the stop on your photo alone and flags it for review. Only use it
                        when the customer has the parcel but cannot give you a code.
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setExceptionArmed(false)}
                          className="flex-1 rounded-xl bg-muted px-3 py-2.5 text-xs font-bold text-foreground"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            finish({
                              type: "photo",
                              photo: photo?.file,
                              photoMeta: photo?.meta,
                              exceptionReason: "OTP_UNAVAILABLE",
                            })
                          }
                          className="flex-1 rounded-xl bg-accent px-3 py-2.5 text-xs font-bold text-accent-foreground disabled:opacity-50"
                        >
                          Complete without code
                        </button>
                      </div>
                    </div>
                  )}
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
          onCapture={(file, meta) => {
            replacePhoto({ file, url: URL.createObjectURL(file), meta });
            // A retake after a failed upload has to clear that failure, or the
            // rider reads the old error as a verdict on the new photo.
            setFailure(null);
            setMode("otp");
          }}
          // Backing out returns to the stop, never forward — the photo is required.
          onCancel={() => setMode("details")}
        />
      )}
    </div>
  );
};
