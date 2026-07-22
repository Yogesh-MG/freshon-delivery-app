import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { PhoneFrame } from "@/components/freshon/PhoneFrame";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2 } from "lucide-react";

const phoneSchema = z.object({
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian number").min(10).max(10),
});

const otpSchema = z.object({
  otp: z.string().trim().regex(/^\d{6}$/, "OTP must be 6 digits").length(6),
});

const OTP_SLOTS = [0, 1, 2, 3, 4, 5];

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading, sendOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  useEffect(() => {
    if (!loading && user) {
      navigate(user.is_profile_complete ? "/" : "/onboarding", { replace: true });
    }
  }, [loading, user, navigate]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = phoneSchema.safeParse({ phone });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const result = await sendOtp(parsed.data.phone);
    if (result.success) {
      toast.success("OTP sent to your phone");
      setOtp("");
      setStep("otp");
    } else {
      toast.error(result.error || "Failed to send OTP");
    }
    setBusy(false);
  };

  const handleVerifyOtp = async (code: string) => {
    const parsed = otpSchema.safeParse({ otp: code });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const result = await verifyOtp(phone, parsed.data.otp);
    if (result.success) {
      navigate(result.data?.is_profile_complete ? "/" : "/onboarding", { replace: true });
    } else {
      toast.error(result.error || "Invalid OTP");
      setOtp("");
    }
    setBusy(false);
  };

  const backToPhone = () => {
    setStep("phone");
    setOtp("");
  };

  return (
    <main className="h-dvh overflow-hidden">
      <PhoneFrame>
        <div className="flex min-h-full flex-col justify-center px-7 pb-12">
          <BikeMark />

          {step === "phone" ? (
            <form onSubmit={handleSendOtp} className="mt-10 space-y-3 animate-fade-up">
              <div className="flex h-14 items-center gap-2 rounded-2xl bg-card px-4 ring-1 ring-border focus-within:ring-2 focus-within:ring-primary">
                <span className="text-base font-bold text-muted-foreground">+91</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  required
                  autoFocus
                  maxLength={10}
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="98765 43210"
                  aria-label="Phone number"
                  className="h-full flex-1 bg-transparent text-base font-semibold tracking-wide text-foreground outline-none placeholder:font-medium placeholder:text-muted-foreground/50"
                />
              </div>

              <button disabled={busy} className="btn-primary w-full">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Continue
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleVerifyOtp(otp);
              }}
              className="mt-10 space-y-4 animate-fade-up"
            >
              <p className="text-center text-sm text-muted-foreground">
                Code sent to <span className="font-bold text-foreground">+91 {phone}</span>
              </p>

              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
                onComplete={(code) => !busy && handleVerifyOtp(code)}
                disabled={busy}
                autoFocus
                containerClassName="justify-center"
              >
                <InputOTPGroup className="gap-2">
                  {OTP_SLOTS.map((i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="h-14 w-12 rounded-2xl border border-border bg-card text-xl font-extrabold text-foreground ring-primary first:rounded-l-2xl last:rounded-r-2xl"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              <button disabled={busy} className="btn-primary w-full">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify
              </button>

              <button
                type="button"
                onClick={backToPhone}
                className="w-full text-center text-xs font-bold text-muted-foreground transition hover:text-primary"
              >
                Change number
              </button>
            </form>
          )}
        </div>
      </PhoneFrame>

      <style>{`
        .btn-primary { display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          height: 56px; border-radius: 16px; padding: 0 20px;
          background: var(--gradient-primary); color: hsl(var(--primary-foreground));
          font-size: 15px; font-weight: 700; box-shadow: var(--shadow-glow-primary);
          transition: transform .15s; }
        .btn-primary:hover:not(:disabled) { transform: scale(1.01); }
        .btn-primary:disabled { opacity: .6; cursor: not-allowed; }
      `}</style>
    </main>
  );
};

// Brand mark for the sign-in screen — the FreshOn Go tile carries a motorbike
// glyph (lucide has no motorcycle icon, so this is drawn in lucide's stroke
// style: 24x24, currentColor, round caps) to signal the partner app.
const BikeMark = () => (
  <div className="flex flex-col items-center gap-3">
    <div className="grid h-20 w-20 place-items-center rounded-[26px] bg-gradient-primary shadow-glow-primary">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-10 w-10 text-primary-foreground"
        aria-hidden="true"
      >
        <circle cx="5" cy="16.5" r="3.5" />
        <circle cx="19" cy="16.5" r="3.5" />
        <path d="M5 16.5 9 9.5h5.5l4 7" />
        <path d="M14.5 9.5 16.5 6H20" />
        <path d="M9 9.5 7.5 6.5" />
      </svg>
    </div>
    <div className="text-center">
      <div className="text-2xl font-extrabold tracking-tight text-foreground">
        FreshOn<span className="text-primary"> Go</span>
      </div>
      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Partner</div>
    </div>
  </div>
);

export default Auth;
