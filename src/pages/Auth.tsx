import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { PhoneFrame } from "@/components/freshon/PhoneFrame";
import { Wordmark } from "@/components/freshon/Wordmark";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
    BadgeCheck,
    Bike,
    Box,
    Clock,
    Leaf,
    Loader2,
    MapPin,
    Navigation,
    Package,
    PackageCheck,
    Route,
    ScanLine,
    ShoppingBag,
    Timer,
    Truck,
    Wallet,
} from "lucide-react";
import { Motorbike } from "./Onboarding";
import { LOGIN_RESEND_COOLDOWN_S, loginOtpKey, useOtpSession } from "@/lib/otpSession";

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

    // Keyed by number, and held outside this component, so the lock survives
    // the rider backing out to the phone step and coming straight back.
    const { remaining: cooldown, noteResend, clear: clearOtpSession } = useOtpSession(
        phone.length === 10 ? loginOtpKey(phone) : null,
    );

    useEffect(() => {
        if (!loading && user) {
            navigate(user.is_profile_complete ? "/" : "/onboarding", { replace: true });
        }
    }, [loading, user, navigate]);

    /**
     * Sends the code, and doubles as the resend.
     *
     * There was no resend at all: a rider whose SMS never arrived had to tap
     * "Change number", retype the number they already had, and submit again —
     * which sent a second code with no cooldown of any kind between them.
     */
    const requestOtp = async (resent: boolean) => {
        const parsed = phoneSchema.safeParse({ phone });
        if (!parsed.success) {
            toast.error(parsed.error.issues[0].message);
            return;
        }
        if (resent && cooldown > 0) return;

        setBusy(true);
        const result = await sendOtp(parsed.data.phone);
        setBusy(false);

        if (!result.success) {
            toast.error(result.error || "Failed to send OTP");
            return;
        }
        toast.success(resent ? "New code sent" : "OTP sent to your phone");
        noteResend(LOGIN_RESEND_COOLDOWN_S);
        setOtp("");
        setStep("otp");
    };

    const handleSendOtp = (e: React.FormEvent) => {
        e.preventDefault();
        void requestOtp(false);
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
            // Signed in — the code is spent, so its cooldown retires with it.
            clearOtpSession();
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
                <div className="relative flex min-h-full flex-col justify-center overflow-hidden px-7 pb-12">
                    <DeliveryBackdrop />

                    <div className="relative z-10">
                        <BikeMark />
                    </div>

                    {step === "phone" ? (
                        <form onSubmit={handleSendOtp} className="relative z-10 mt-10 space-y-3 animate-fade-up">
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
                            className="relative z-10 mt-10 space-y-4 animate-fade-up"
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

                            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                                <span>Didn't get the code?</span>
                                <button
                                    type="button"
                                    onClick={() => void requestOtp(true)}
                                    disabled={busy || cooldown > 0}
                                    className="font-bold text-primary transition hover:underline disabled:opacity-50 disabled:no-underline"
                                >
                                    {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                                </button>
                            </div>

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

        /* Fade the glyph field out towards the middle so the form always reads
           against clean background, and in at the edges for a framed look. */
        .auth-backdrop {
          -webkit-mask-image: radial-gradient(ellipse 72% 46% at 50% 50%, transparent 30%, #000 100%);
          mask-image: radial-gradient(ellipse 72% 46% at 50% 50%, transparent 30%, #000 100%);
        }
        .auth-glyph {
          position: absolute;
          opacity: .24;
          /* Keyframes outrank inline styles, so the per-glyph rotation has to
             ride through --r inside the animation rather than on the element. */
          transform: rotate(var(--r, 0deg));
          animation: auth-drift 9s ease-in-out infinite;
        }
        @keyframes auth-drift {
          0%, 100% { transform: translateY(0) rotate(var(--r, 0deg)); }
          50%      { transform: translateY(-10px) rotate(calc(var(--r, 0deg) * -1)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .auth-glyph { animation: none; }
        }
      `}</style>
        </main>
    );
};

// Scattered delivery glyphs behind the sign-in card. Positions are hand-placed
// (rather than random) so nothing lands under the phone/OTP inputs, and a
// radial mask fades the whole layer out towards the centre where the form sits.
const BACKDROP_ICONS = [
    { Icon: Package, x: 6, y: 4, size: 46, rotate: -14, tone: "primary", delay: 0 },
    { Icon: MapPin, x: 74, y: 3, size: 40, rotate: 10, tone: "accent", delay: 1.4 },
    { Icon: Bike, x: 42, y: 10, size: 52, rotate: 6, tone: "primary", delay: 2.6 },
    { Icon: Navigation, x: 87, y: 16, size: 34, rotate: 24, tone: "primary", delay: 0.8 },
    { Icon: Leaf, x: 16, y: 18, size: 38, rotate: 18, tone: "accent", delay: 3.2 },
    { Icon: Clock, x: 64, y: 25, size: 34, rotate: 0, tone: "primary", delay: 2.2 },
    { Icon: Route, x: 3, y: 31, size: 44, rotate: -8, tone: "primary", delay: 1.9 },
    { Icon: ShoppingBag, x: 84, y: 33, size: 46, rotate: -12, tone: "accent", delay: 4.1 },
    { Icon: ScanLine, x: 4, y: 74, size: 40, rotate: 12, tone: "accent", delay: 3.6 },
    { Icon: Wallet, x: 80, y: 72, size: 40, rotate: -16, tone: "primary", delay: 1.1 },
    { Icon: Truck, x: 44, y: 77, size: 50, rotate: 8, tone: "primary", delay: 0.5 },
    { Icon: PackageCheck, x: 14, y: 84, size: 46, rotate: -6, tone: "primary", delay: 4.6 },
    { Icon: Timer, x: 63, y: 87, size: 38, rotate: 14, tone: "accent", delay: 2.9 },
    { Icon: BadgeCheck, x: 87, y: 88, size: 34, rotate: 6, tone: "primary", delay: 3.9 },
    { Icon: Box, x: 33, y: 92, size: 44, rotate: -10, tone: "primary", delay: 1.6 },
] as const;

const DeliveryBackdrop = () => (
    <div className="auth-backdrop pointer-events-none absolute inset-0 z-0 select-none" aria-hidden="true">
        {BACKDROP_ICONS.map(({ Icon, x, y, size, rotate, tone, delay }, i) => (
            <Icon
                key={i}
                className={tone === "accent" ? "auth-glyph text-accent" : "auth-glyph text-primary"}
                style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    width: size,
                    height: size,
                    ["--r" as string]: `${rotate}deg`,
                    animationDelay: `${delay}s`,
                }}
                strokeWidth={1.75}
            />
        ))}
    </div>
);

// Brand mark for the sign-in screen — the FreshOn Go tile carries the shared
// Motorbike glyph (lucide has no motorcycle icon, so it's drawn in lucide's
// stroke style: 24x24, currentColor, round caps) to signal the partner app.
// The glyph has no intrinsic size, so the tile is what sizes it.
const BikeMark = () => (
    <div className="flex flex-col items-center gap-3">
        <div className="grid h-20 w-20 place-items-center rounded-[26px] bg-gradient-primary shadow-glow-primary">
            <Motorbike className="h-10 w-10 text-primary-foreground" />
        </div>
        <Wordmark size="lg" />
    </div>
);

export default Auth;
