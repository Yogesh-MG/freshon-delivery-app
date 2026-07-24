import { Stop } from "@/lib/types";
import { openInGoogleMaps } from "@/lib/mapApps";
import { Camera, CheckCircle2, KeyRound, Navigation, Phone, ScanLine, Wallet, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Mode = "details" | "otp" | "photo" | "done";

export const ProofDrawer = ({
  stop,
  onClose,
  onComplete,
  onResend,
}: {
  stop: Stop | null;
  onClose: () => void;
  onComplete: (stop: Stop, proof: { type: "otp" | "photo"; otpCode?: string; photo?: File }) => Promise<boolean>;
  onResend?: (stop: Stop) => Promise<void>;
}) => {
  const [mode, setMode] = useState<Mode>("details");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [cod, setCod] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [confetti, setConfetti] = useState<{ id: number; x: number; r: number; d: number; c: string }[]>([]);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (stop) {
      setMode("details");
      setOtp(["", "", "", "", "", ""]);
      setCod(false);
      setPhoto(null);
    }
  }, [stop?.id]);

  const resend = async () => {
    if (!stop || !onResend) return;
    setResending(true);
    await onResend(stop);
    setResending(false);
  };

  const otpFilled = otp.every((d) => d !== "");

  const finish = async (proof: { type: "otp" | "photo"; otpCode?: string; photo?: File }) => {
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

        <div className="max-h-[70vh] overflow-y-auto px-5 pb-6 pt-4 no-scrollbar">
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
              {stop.type === "dropoff" ? (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button onClick={() => setMode("otp")} className="flex flex-col items-center gap-1 rounded-2xl bg-gradient-primary p-4 text-primary-foreground shadow-glow-primary">
                    <KeyRound className="h-5 w-5" /><span className="text-sm font-bold">OTP</span>
                  </button>
                  <button onClick={() => setMode("photo")} className="flex flex-col items-center gap-1 rounded-2xl bg-secondary p-4 text-secondary-foreground">
                    <Camera className="h-5 w-5" /><span className="text-sm font-bold">Photo Proof</span>
                  </button>
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
                    className="h-14 w-11 rounded-2xl border border-border bg-card text-center text-2xl font-extrabold text-foreground outline-none ring-primary transition focus:ring-2"
                  />
                ))}
              </div>
              <label className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3 text-sm">
                <span className="flex items-center gap-2 font-semibold text-foreground"><Wallet className="h-4 w-4 text-primary" /> Cash on delivery collected</span>
                <input type="checkbox" checked={cod} onChange={(e) => setCod(e.target.checked)} className="h-5 w-5 accent-[hsl(var(--primary))]" />
              </label>
              <button
                disabled={!otpFilled || busy}
                onClick={() => finish({ type: "otp", otpCode: otp.join("") })}
                className="w-full rounded-2xl bg-gradient-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-glow-primary transition disabled:opacity-50"
              >
                Verify & Complete
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
                  <button
                    type="button"
                    onClick={() => setMode("photo")}
                    className="font-bold text-secondary hover:underline"
                  >
                    Use photo instead
                  </button>
                </div>
              )}
            </div>
          )}

          {mode === "photo" && (
            <div className="space-y-4 py-2">
              <label className="relative block aspect-[4/3] overflow-hidden rounded-2xl bg-secondary">
                <div className="absolute inset-0 map-grid opacity-40" />
                <div className="absolute inset-4 rounded-xl border-2 border-dashed border-accent/80" />
                <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-accent/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">
                  Freshness Verification
                </div>
                <div className="absolute inset-0 grid place-items-center">
                  <div className="grid place-items-center gap-2 text-center">
                    <Camera className="h-10 w-10 text-accent/80" />
                    <span className="px-4 text-xs font-semibold text-primary-foreground/80">
                      {photo ? photo.name : "Tap to choose photo"}
                    </span>
                  </div>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(event) => setPhoto(event.target.files?.[0] || null)}
                />
              </label>
              <button onClick={() => finish({ type: "photo", photo: photo || undefined })} disabled={busy} className="w-full rounded-2xl bg-gradient-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-glow-primary disabled:opacity-50">
                Capture & Complete
              </button>
            </div>
          )}

          {mode === "done" && (
            <div className="relative grid place-items-center py-8">
              {confetti.map((c) => (
                <span
                  key={c.id}
                  className="absolute h-2 w-1 animate-sprout"
                  style={{
                    left: `${c.x}%`, top: "40%", background: c.c,
                    transform: `rotate(${c.r}deg)`, animationDelay: `${c.d}s`,
                  }}
                />
              ))}
              <div className="relative grid h-24 w-24 place-items-center">
                <div className="absolute inset-0 rounded-full bg-primary-soft animate-sprout" />
                <svg viewBox="0 0 64 64" className="relative h-16 w-16">
                  <path d="M32 56 V30" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round" className="draw-check" />
                  <path d="M32 30 C20 24 18 14 28 10 C30 22 38 22 36 32 Z" fill="hsl(var(--primary))" className="animate-sprout" style={{ transformOrigin: "32px 32px" }} />
                  <path d="M22 44 l8 8 l16 -18" fill="none" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" className="draw-check" />
                </svg>
              </div>
              <div className="mt-4 text-lg font-extrabold text-foreground">Delivery complete</div>
              <div className="text-xs text-muted-foreground">Earnings will update after sync</div>
              <button onClick={onClose} className="mt-5 rounded-2xl bg-secondary px-6 py-3 text-sm font-bold text-secondary-foreground">
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Back to mission</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
