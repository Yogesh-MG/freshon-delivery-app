import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { FreshOnLogo } from "@/components/freshon/Logo";
import { PhoneFrame } from "@/components/freshon/PhoneFrame";
import { Loader2, Phone, Plus } from "lucide-react";

const phoneSchema = z.object({
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian number").min(10).max(10),
});

const otpSchema = z.object({
  otp: z.string().trim().regex(/^\d{6}$/, "OTP must be 6 digits").length(6),
});

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading, sendOtp, verifyOtp } = useAuth();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

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
      setStep("otp");
      setOtpSent(true);
    } else {
      toast.error(result.error || "Failed to send OTP");
    }
    setBusy(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = otpSchema.safeParse({ otp });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const result = await verifyOtp(phone, parsed.data.otp);
    if (result.success) {
      toast.success("Welcome! Setting up device...");
      const isComplete = result.data?.is_profile_complete;
      navigate(isComplete ? "/" : "/onboarding", { replace: true });
    } else {
      toast.error(result.error || "Invalid OTP");
    }
    setBusy(false);
  };

  return (
    <main className="min-h-screen">
      <PhoneFrame>
        <div className="flex min-h-full flex-col px-6 pt-8 pb-10">
          <FreshOnLogo />

          <div className="mt-8 animate-fade-up">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Partner Sign-in</div>
            <h1 className="mt-1 text-3xl font-extrabold leading-tight tracking-tight text-foreground text-balance">
              {step === "phone" ? "Welcome back" : "Enter OTP"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {step === "phone" ? "Sign in with your phone number" : "Check your SMS for the code"}
            </p>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-muted px-3 py-2.5 text-sm font-bold text-foreground">
            <Phone className="h-4 w-4 text-primary" />
            Delivery Partner
          </div>

          {step === "phone" ? (
            <form onSubmit={handleSendOtp} className="mt-5 space-y-3 animate-fade-up">
              <Field label="Phone number">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  required
                  maxLength={10}
                  className="field"
                  placeholder="98765 43210"
                  autoComplete="tel"
                />
              </Field>

              <button disabled={busy} className="btn-primary w-full">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Send OTP
              </button>

              <button
                type="button"
                onClick={() => navigate("/onboarding")}
                className="w-full rounded-2xl border border-border bg-transparent py-3 text-center text-sm font-bold text-foreground transition hover:bg-muted"
              >
                <Plus className="mr-1 inline h-3.5 w-3.5" />
                New partner? Complete your profile
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="mt-5 space-y-3 animate-fade-up">
              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted-foreground">Sent to +91 {phone}</p>
              </div>

              <Field label="6-digit OTP">
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  maxLength={6}
                  className="field text-center text-2xl tracking-widest"
                  placeholder="000000"
                  autoComplete="one-time-code"
                />
              </Field>

              <button disabled={busy} className="btn-primary w-full">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify & Sign In
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setOtp("");
                  setOtpSent(false);
                }}
                className="w-full rounded-2xl border border-border bg-transparent py-3 text-center text-sm font-bold text-foreground transition hover:bg-muted"
              >
                Back
              </button>

              {otpSent && (
                <p className="text-center text-xs text-muted-foreground">
                  Didn't receive? Check your SMS or{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setStep("phone");
                      setOtp("");
                      setOtpSent(false);
                    }}
                    className="font-bold text-primary hover:underline"
                  >
                    request a new code
                  </button>
                </p>
              )}
            </form>
          )}

          <div className="mt-auto pt-8 text-center text-[11px] text-muted-foreground">
            By continuing you agree to FreshOn's Partner Terms & Privacy Policy.
          </div>
        </div>
      </PhoneFrame>

      <style>{`
        .field { width: 100%; height: 48px; border-radius: 14px; padding: 0 14px;
          background: hsl(var(--card)); border: 1px solid hsl(var(--border));
          font-size: 14px; font-weight: 500; color: hsl(var(--foreground));
          outline: none; transition: all .15s; }
        .field:focus { border-color: hsl(var(--primary)); box-shadow: 0 0 0 3px hsl(var(--primary) / 0.15); }
        .btn-primary { display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          height: 48px; border-radius: 14px; padding: 0 20px;
          background: var(--gradient-primary); color: hsl(var(--primary-foreground));
          font-size: 14px; font-weight: 700; box-shadow: var(--shadow-glow-primary);
          transition: transform .15s; }
        .btn-primary:hover:not(:disabled) { transform: scale(1.01); }
        .btn-primary:disabled { opacity: .6; cursor: not-allowed; }
      `}</style>
    </main>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
    {children}
  </label>
);

export default Auth;
