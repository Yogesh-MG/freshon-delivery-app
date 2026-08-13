import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
    Bike,
    Edit2,
    IndianRupee,
    Landmark,
    Loader2,
    LogOut,
    Moon,
    MapPin,
    Car,
    Banknote,
    Package,
    Phone,
    Truck,
    User,
    Volume2,
    VolumeX,
    LifeBuoy,
    Zap,
} from "lucide-react";
// import { Switch } from "@/components/ui/switch";
import { isMuted, play, setMuted } from "@/lib/sound";
import { PhoneFrame } from "@/components/freshon/PhoneFrame";
import { Wordmark } from "@/components/freshon/Wordmark";
import { BottomNav } from "@/components/freshon/BottomNav";
import { RatingBadge } from "@/components/freshon/RatingBadge";
import { DeliveryPartnerService, DeliveryPartnerProfile } from "@/lib/deliveryPartnerService";
import { Motorbike } from "./Onboarding";
import { backendAuthService } from "@/lib/backendAuthService";
import { useAuth } from "@/hooks/useAuth";
import { SUPPORT_PHONE, dialPhone } from "@/lib/contact";
import { useTheme, type ThemeChoice } from "@/lib/theme";

/** "System" first: it is the default and the right answer for most riders. */
const THEME_OPTIONS: { value: ThemeChoice; label: string }[] = [
    { value: "system", label: "System" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
];

const VEHICLE_ICONS = {
    BIKE: Bike,
    SCOOTER: Motorbike,
    VAN: Truck,
};

const VEHICLE_NAMES = {
    BIKE: "Motorbike",
    SCOOTER: "Scooty",
    VAN: "Van",
};

// Bicycles are no longer offered at sign-up, so they're not selectable here either.
const VEHICLE_OPTIONS = ["SCOOTER", "BIKE", "VAN"] as const;
type VehicleOption = (typeof VEHICLE_OPTIONS)[number];

// The backend can still hand back a legacy "CYCLE", which no longer has an icon
// or label — fall back to the nearest option so the page renders either way.
const toVehicleOption = (value: string): VehicleOption =>
    VEHICLE_OPTIONS.some((v) => v === value) ? (value as VehicleOption) : "SCOOTER";

const Profile = () => {
    const navigate = useNavigate();
    const { signOut } = useAuth();
    const { choice: theme, choose: chooseTheme } = useTheme();
    const [profile, setProfile] = useState<DeliveryPartnerProfile | null>(null);
    // Seeded from localStorage inside the sound module, so the choice survives
    // restarts and OTA bundle swaps.
    // const [soundMuted, setSoundMuted] = useState(isMuted);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        vehicle_type: "BIKE" as "BIKE" | "SCOOTER" | "VAN",
        vehicle_number: "",
        address: "",
        city: "",
        pincode: "",
    });
    // Payout / payment KYC
    const [editingPayout, setEditingPayout] = useState(false);
    const [savingPayout, setSavingPayout] = useState(false);
    const [payoutForm, setPayoutForm] = useState({
        payout_method: "" as "" | "UPI" | "BANK",
        bank_upi: "",
        bank_account_name: "",
        bank_account_number: "",
        bank_ifsc: "",
    });

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        setLoading(true);
        const result = await DeliveryPartnerService.getProfile();
        if (result.success && result.data) {
            setProfile(result.data);
            setEditForm({
                vehicle_type: toVehicleOption(result.data.vehicle_type),
                vehicle_number: result.data.vehicle_number,
                address: result.data.address || "",
                city: result.data.city || "",
                pincode: result.data.pincode || "",
            });
            setPayoutForm({
                payout_method: result.data.payout_method || "",
                bank_upi: result.data.bank_upi || "",
                bank_account_name: result.data.bank_account_name || "",
                bank_account_number: result.data.bank_account_number || "",
                bank_ifsc: result.data.bank_ifsc || "",
            });
        } else {
            toast.error(result.error || "Failed to load profile");
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const result = await DeliveryPartnerService.updateProfile(editForm);
        if (result.success && result.data) {
            setProfile(result.data);
            setEditing(false);
            toast.success("Profile updated");
        } else {
            toast.error(result.error || "Failed to update profile");
        }
        setSaving(false);
    };

    const handleSavePayout = async () => {
        const isUpi = payoutForm.payout_method === "UPI";
        // Lightweight validation mirroring onboarding.
        if (payoutForm.payout_method !== "UPI" && payoutForm.payout_method !== "BANK") {
            toast.error("Choose how you want to get paid");
            return;
        }
        if (isUpi && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(payoutForm.bank_upi.trim())) {
            toast.error("Enter a valid UPI ID (e.g. name@oksbi)");
            return;
        }
        if (!isUpi) {
            if (payoutForm.bank_account_name.trim().length < 2) return toast.error("Enter the account holder name");
            if (!/^\d{9,18}$/.test(payoutForm.bank_account_number.trim())) return toast.error("Enter a valid account number");
            if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(payoutForm.bank_ifsc.trim())) return toast.error("Enter a valid IFSC code");
        }

        setSavingPayout(true);
        const result = await DeliveryPartnerService.updateProfile({
            payout_method: payoutForm.payout_method,
            bank_upi: isUpi ? payoutForm.bank_upi.trim() : "",
            bank_account_name: isUpi ? "" : payoutForm.bank_account_name.trim(),
            bank_account_number: isUpi ? "" : payoutForm.bank_account_number.trim(),
            bank_ifsc: isUpi ? "" : payoutForm.bank_ifsc.trim().toUpperCase(),
        });
        if (result.success && result.data) {
            setProfile(result.data);
            setEditingPayout(false);
            toast.success("Payout details updated");
        } else {
            toast.error(result.error || "Failed to update payout details");
        }
        setSavingPayout(false);
    };

    const handleLogout = async () => {
        await signOut();
        navigate("/auth", { replace: true });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
        }).format(amount);
    };

    return (
        <main className="h-dvh overflow-hidden">
            <PhoneFrame>
                <div className="flex h-full flex-col">
                    <header className="px-5 pt-7">
                        <Wordmark />
                    </header>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto space-y-4 px-5 pb-4 pt-5">
                        <div>
                            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Profile</h2>
                            <p className="mt-0.5 text-sm text-muted-foreground">Manage your account details</p>
                        </div>

                        {loading ? (
                            <div className="grid place-items-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : profile ? (
                            <>
                                {/* Profile Card */}
                                <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-5 text-primary-foreground shadow-glow-primary">
                                    {/* Soft highlight so the flat gradient reads as a surface. */}
                                    <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
                                    <div className="relative flex items-center gap-4">
                                        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/25 backdrop-blur">
                                            <User className="h-8 w-8" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-lg font-extrabold leading-tight">{profile.name}</div>
                                            <div className="truncate text-sm opacity-90">@{profile.username}</div>
                                            <div className="mt-2">
                                                <RatingBadge rating={profile.rating} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-2 gap-3">
                                    <StatCard
                                        icon={Package}
                                        label="Total Deliveries"
                                        value={profile.total_deliveries.toString()}
                                    />
                                    <StatCard
                                        icon={Banknote}
                                        label="Total Earnings"
                                        value={formatCurrency(profile.total_earnings)}
                                    />
                                </div>

                                {/* Vehicle Info */}
                                <div className="rounded-3xl bg-card p-4 shadow-card-soft ring-1 ring-border">
                                    <div className="mb-3.5 flex items-center justify-between gap-3">
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                            Vehicle &amp; Address
                                        </h3>
                                        {!editing && (
                                            <button
                                                onClick={() => setEditing(true)}
                                                className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-1.5 text-xs font-bold text-foreground transition active:scale-95"
                                            >
                                                <Edit2 className="h-3 w-3" /> Edit
                                            </button>
                                        )}
                                    </div>

                                    {editing ? (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                    Vehicle Type
                                                </label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {VEHICLE_OPTIONS.map((type) => {
                                                        const Icon = VEHICLE_ICONS[type];
                                                        const active = editForm.vehicle_type === type;
                                                        return (
                                                            <button
                                                                key={type}
                                                                type="button"
                                                                onClick={() => setEditForm({ ...editForm, vehicle_type: type })}
                                                                className={`flex min-h-[62px] flex-col items-center justify-center gap-1.5 rounded-2xl p-2.5 text-[11px] font-bold transition active:scale-95
                                  ${active ? "bg-gradient-primary text-primary-foreground shadow-glow-primary" : "bg-muted text-muted-foreground"}`}
                                                            >
                                                                <Icon className="h-5 w-5" /> {VEHICLE_NAMES[type]}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                    Vehicle Number
                                                </label>
                                                <input
                                                    type="text"
                                                    value={editForm.vehicle_number}
                                                    onChange={(e) => setEditForm({ ...editForm, vehicle_number: e.target.value.toUpperCase() })}
                                                    placeholder="MH 12 AB 1234"
                                                    maxLength={20}
                                                    className="w-full rounded-2xl border border-border bg-background px-3.5 py-3 text-base font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                    Address
                                                </label>
                                                <textarea
                                                    value={editForm.address}
                                                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                                                    placeholder="Your residential address"
                                                    maxLength={200}
                                                    className="min-h-[64px] w-full rounded-2xl border border-border bg-background px-3.5 py-3 text-base font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                        City
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={editForm.city}
                                                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                                                        placeholder="City"
                                                        maxLength={60}
                                                        className="w-full rounded-2xl border border-border bg-background px-3.5 py-3 text-base font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                        Pincode
                                                    </label>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={editForm.pincode}
                                                        onChange={(e) => setEditForm({ ...editForm, pincode: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                                                        placeholder="Pincode"
                                                        maxLength={8}
                                                        className="w-full rounded-2xl border border-border bg-background px-3.5 py-3 text-base font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setEditing(false)}
                                                    className="flex-1 rounded-2xl bg-muted py-3 text-sm font-bold text-foreground transition active:scale-[0.98]"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleSave}
                                                    disabled={saving}
                                                    className="flex-1 rounded-2xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow-primary transition active:scale-[0.98] disabled:opacity-50"
                                                >
                                                    {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Save"}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        // Hairline dividers instead of loose spacing — four label/value
                                        // pairs read as one list rather than four floating rows.
                                        <div className="divide-y divide-border">
                                            <DetailRow
                                                icon={VEHICLE_ICONS[toVehicleOption(profile.vehicle_type)]}
                                                label="Vehicle Type"
                                                value={VEHICLE_NAMES[toVehicleOption(profile.vehicle_type)]}
                                            />
                                            <DetailRow
                                                icon={Car}
                                                label="Vehicle Number"
                                                value={profile.vehicle_number || "Not set"}
                                            />
                                            <DetailRow icon={Phone} label="Phone" value={profile.phone || "Not set"} />
                                            <DetailRow
                                                icon={MapPin}
                                                label="Address"
                                                value={
                                                    [profile.address, profile.city, profile.pincode].filter(Boolean).join(", ") ||
                                                    "Not set"
                                                }
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Payout details */}
                                <div className="rounded-3xl bg-card p-4 shadow-card-soft ring-1 ring-border">
                                    <div className="mb-3.5 flex items-center justify-between gap-3">
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                            Payout details
                                        </h3>
                                        {!editingPayout && (
                                            <button
                                                onClick={() => setEditingPayout(true)}
                                                className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-1.5 text-xs font-bold text-foreground transition active:scale-95"
                                            >
                                                <Edit2 className="h-3 w-3" /> Edit
                                            </button>
                                        )}
                                    </div>

                                    {editingPayout ? (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-2">
                                                {(["UPI", "BANK"] as const).map((m) => {
                                                    const Icon = m === "UPI" ? IndianRupee : Landmark;
                                                    const active = payoutForm.payout_method === m;
                                                    return (
                                                        <button
                                                            key={m}
                                                            type="button"
                                                            onClick={() => setPayoutForm({ ...payoutForm, payout_method: m })}
                                                            className={`flex min-h-[44px] items-center justify-center gap-2 rounded-2xl p-2 text-sm font-bold transition active:scale-95
                                ${active ? "bg-gradient-primary text-primary-foreground shadow-glow-primary" : "bg-muted text-muted-foreground"}`}
                                                        >
                                                            <Icon className="h-4 w-4" /> {m === "UPI" ? "UPI" : "Bank account"}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {payoutForm.payout_method === "UPI" && (
                                                <div>
                                                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                        UPI ID
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={payoutForm.bank_upi}
                                                        onChange={(e) => setPayoutForm({ ...payoutForm, bank_upi: e.target.value.trim() })}
                                                        placeholder="name@oksbi"
                                                        inputMode="email"
                                                        autoCapitalize="none"
                                                        autoCorrect="off"
                                                        spellCheck={false}
                                                        className="w-full rounded-2xl border border-border bg-background px-3.5 py-3 text-base font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                    />
                                                </div>
                                            )}

                                            {payoutForm.payout_method === "BANK" && (
                                                <>
                                                    <div>
                                                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                            Account holder name
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={payoutForm.bank_account_name}
                                                            onChange={(e) => setPayoutForm({ ...payoutForm, bank_account_name: e.target.value })}
                                                            placeholder="As per bank records"
                                                            maxLength={120}
                                                            autoCapitalize="words"
                                                            className="w-full rounded-2xl border border-border bg-background px-3.5 py-3 text-base font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                            Account number
                                                        </label>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            value={payoutForm.bank_account_number}
                                                            onChange={(e) =>
                                                                setPayoutForm({ ...payoutForm, bank_account_number: e.target.value.replace(/\D/g, "").slice(0, 18) })
                                                            }
                                                            placeholder="Account number"
                                                            maxLength={18}
                                                            className="w-full rounded-2xl border border-border bg-background px-3.5 py-3 text-base font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                            IFSC code
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={payoutForm.bank_ifsc}
                                                            onChange={(e) =>
                                                                setPayoutForm({ ...payoutForm, bank_ifsc: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11) })
                                                            }
                                                            placeholder="e.g. SBIN0001234"
                                                            maxLength={11}
                                                            autoCapitalize="characters"
                                                            autoCorrect="off"
                                                            spellCheck={false}
                                                            className="w-full rounded-2xl border border-border bg-background px-3.5 py-3 text-base font-medium uppercase text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setEditingPayout(false)}
                                                    className="flex-1 rounded-2xl bg-muted py-3 text-sm font-bold text-foreground transition active:scale-[0.98]"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleSavePayout}
                                                    disabled={savingPayout}
                                                    className="flex-1 rounded-2xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow-primary transition active:scale-[0.98] disabled:opacity-50"
                                                >
                                                    {savingPayout ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Save"}
                                                </button>
                                            </div>
                                        </div>
                                    ) : profile.payout_method === "UPI" && profile.bank_upi ? (
                                        <DetailRow icon={IndianRupee} label="UPI ID" value={profile.bank_upi} flush />
                                    ) : profile.payout_method === "BANK" && profile.bank_account_number ? (
                                        <DetailRow
                                            icon={Landmark}
                                            label={`${profile.bank_account_name || "Account"} · ${profile.bank_ifsc}`}
                                            value={`•••• ${profile.bank_account_number.slice(-4)}`}
                                            flush
                                        />
                                    ) : (
                                        <div className="rounded-2xl bg-muted/50 p-3.5 text-sm text-muted-foreground">
                                            No payout method set. Tap <span className="font-bold text-foreground">Edit</span> to add your UPI or bank account.
                                        </div>
                                    )}
                                </div>

                                {/* {/1* Alert sounds *1/} */}
                                {/* <div className="flex items-center justify-between rounded-2xl bg-card p-4"> */}
                                {/*     <div className="flex items-center gap-3"> */}
                                {/*         <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"> */}
                                {/*             {soundMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />} */}
                                {/*         </div> */}
                                {/*         <div> */}
                                {/*             <div className="text-sm font-bold text-foreground">Alert sounds</div> */}
                                {/*             <div className="text-xs text-muted-foreground"> */}
                                {/*                 {soundMuted ? "Muted — you'll still feel vibrations" : "Chime on new trip offers"} */}
                                {/*             </div> */}
                                {/*         </div> */}
                                {/*     </div> */}
                                {/*     <Switch */}
                                {/*         checked={!soundMuted} */}
                                {/*         onCheckedChange={(on) => { */}
                                {/*             setMuted(!on); */}
                                {/*             setSoundMuted(!on); */}
                                {/*             if (on) play("success"); // preview the cue they just re-enabled */}
                                {/*         }} */}
                                {/*         aria-label="Toggle alert sounds" */}
                                {/*     /> */}
                                {/* </div> */}

                                {/* Rider support — one tap to a human when a
                                    delivery goes wrong mid-shift. */}
                                <button
                                    onClick={() => dialPhone(SUPPORT_PHONE)}
                                    className="flex w-full items-center justify-between gap-3 rounded-3xl bg-card p-4 text-left shadow-card-soft ring-1 ring-border transition active:scale-[0.99]"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
                                            <Phone className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-bold text-foreground">Customer care</div>
                                            <div className="truncate text-xs text-muted-foreground">
                                                {SUPPORT_PHONE} · available 24/7
                                            </div>
                                        </div>
                                    </div>
                                    <span className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-primary px-3.5 py-2.5 text-xs font-bold text-primary-foreground shadow-glow-primary">
                                        <Phone className="h-3.5 w-3.5" /> Call
                                    </span>
                                </button>

                                {/* Appearance — riders working evenings asked for
                                    this more than anything else on this screen. */}
                                <div className="rounded-2xl bg-card p-4 shadow-card-soft ring-1 ring-border">
                                    <div className="mb-3 flex items-center gap-2">
                                        <Moon className="h-4 w-4 text-primary" />
                                        <span className="text-sm font-bold text-foreground">Appearance</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
                                        {THEME_OPTIONS.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                role="radio"
                                                aria-checked={theme === option.value}
                                                onClick={() => chooseTheme(option.value)}
                                                className={`rounded-xl py-2.5 text-xs font-bold transition ${
                                                    theme === option.value
                                                        ? "bg-primary text-primary-foreground shadow-glow-primary"
                                                        : "bg-muted text-muted-foreground"
                                                }`}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        {theme === "system"
                                            ? "Following your phone — switches with it at sunset."
                                            : `Always ${theme}, whatever your phone is set to.`}
                                    </p>
                                </div>

                                {/* Logout */}
                                <button
                                    onClick={handleLogout}
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive/10 py-3.5 text-sm font-bold text-destructive ring-1 ring-destructive/20 transition active:scale-[0.99]"
                                >
                                    <LogOut className="h-4 w-4" /> Sign Out
                                </button>
                            </>
                        ) : null}
                    </div>

                    <BottomNav active="profile" />
                </div>
            </PhoneFrame>
        </main>
    );
};

/**
 * One label/value pair inside a section card. `flush` drops the vertical
 * padding for a card that holds a single row, so it doesn't sit off-centre.
 */
const DetailRow = ({
    icon: Icon,
    label,
    value,
    flush,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
    flush?: boolean;
}) => (
    <div className={`flex items-center gap-3 ${flush ? "" : "py-3 first:pt-0 last:pb-0"}`}>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
            <div className="text-sm font-bold text-foreground">{value}</div>
            <div className="truncate text-xs text-muted-foreground">{label}</div>
        </div>
    </div>
);

const StatCard = ({
    icon: Icon,
    label,
    value,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string;
}) => (
    <div className="rounded-2xl bg-card p-3.5 shadow-card-soft ring-1 ring-border">
        <div className="mb-2.5 grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
            <Icon className="h-4 w-4" />
        </div>
        <div className="truncate text-xl font-extrabold tabular-nums text-foreground">{value}</div>
        <div className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
);


export default Profile;
