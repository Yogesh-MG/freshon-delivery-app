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
    MapPin,
    Package,
    Phone,
    Star,
    Truck,
    User,
    Zap,
} from "lucide-react";
import { PhoneFrame } from "@/components/freshon/PhoneFrame";
import { Wordmark } from "@/components/freshon/Wordmark";
import { BottomNav } from "@/components/freshon/BottomNav";
import { DeliveryPartnerService, DeliveryPartnerProfile } from "@/lib/deliveryPartnerService";
import { Motorbike } from "./Onboarding";
import { backendAuthService } from "@/lib/backendAuthService";
import { useAuth } from "@/hooks/useAuth";

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
    const [profile, setProfile] = useState<DeliveryPartnerProfile | null>(null);
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
        if (isUpi && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(payoutForm.bank_upi.trim())) {
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
                    <header className="px-7 pt-7">
                        <Wordmark />
                    </header>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto space-y-4 px-5 pb-4 pt-5">
                        <div>
                            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Profile</h2>
                            <p className="text-sm text-muted-foreground">Manage your account details</p>
                        </div>

                        {loading ? (
                            <div className="grid place-items-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : profile ? (
                            <>
                                {/* Profile Card */}
                                <div className="rounded-3xl bg-gradient-primary p-5 text-primary-foreground shadow-glow-primary">
                                    <div className="flex items-center gap-4">
                                        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/20 backdrop-blur">
                                            <User className="h-8 w-8" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-lg font-extrabold">{profile.name}</div>
                                            <div className="text-sm opacity-90">@{profile.username}</div>
                                            <div className="mt-1 flex items-center gap-1 text-xs opacity-80">
                                                <Star className="h-3 w-3 fill-current" />
                                                {Number(profile.rating).toFixed(1)} rating
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
                                        icon={MapPin}
                                        label="Total Earnings"
                                        value={formatCurrency(profile.total_earnings)}
                                    />
                                </div>

                                {/* Vehicle Info */}
                                <div className="rounded-3xl bg-card p-4 shadow-card-soft ring-1 ring-border">
                                    <div className="mb-3 flex items-center justify-between">
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                            Vehicle &amp; Address
                                        </h3>
                                        {!editing && (
                                            <button
                                                onClick={() => setEditing(true)}
                                                className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs font-bold text-foreground"
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
                                                                className={`flex flex-col items-center gap-1 rounded-2xl p-2.5 text-[10px] font-bold transition
                                  ${active ? "bg-gradient-primary text-primary-foreground shadow-glow-primary" : "bg-muted text-muted-foreground"}`}
                                                            >
                                                                <Icon className="h-4 w-4" /> {VEHICLE_NAMES[type]}
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
                                                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                                                    className="min-h-[64px] w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                                                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                                                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setEditing(false)}
                                                    className="flex-1 rounded-xl bg-muted py-2.5 text-sm font-bold text-foreground"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleSave}
                                                    disabled={saving}
                                                    className="flex-1 rounded-xl bg-gradient-primary py-2.5 text-sm font-bold text-primary-foreground shadow-glow-primary disabled:opacity-50"
                                                >
                                                    {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Save"}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                                                    {(() => {
                                                        const Icon = VEHICLE_ICONS[toVehicleOption(profile.vehicle_type)];
                                                        return <Icon className="h-5 w-5" />;
                                                    })()}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-foreground">
                                                        {VEHICLE_NAMES[toVehicleOption(profile.vehicle_type)]}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">Vehicle Type</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                                                    <MapPin className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-foreground">
                                                        {profile.vehicle_number || "Not set"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">Vehicle Number</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                                                    <Phone className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-foreground">
                                                        {profile.phone || "Not set"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">Phone</div>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-3">
                                                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                                                    <MapPin className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-foreground">
                                                        {[profile.address, profile.city, profile.pincode].filter(Boolean).join(", ") || "Not set"}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">Address</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Payout details */}
                                <div className="rounded-3xl bg-card p-4 shadow-card-soft ring-1 ring-border">
                                    <div className="mb-3 flex items-center justify-between">
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                            Payout details
                                        </h3>
                                        {!editingPayout && (
                                            <button
                                                onClick={() => setEditingPayout(true)}
                                                className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs font-bold text-foreground"
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
                                                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                                                            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                                                            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                                                            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium uppercase text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setEditingPayout(false)}
                                                    className="flex-1 rounded-xl bg-muted py-2.5 text-sm font-bold text-foreground"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={handleSavePayout}
                                                    disabled={savingPayout}
                                                    className="flex-1 rounded-xl bg-gradient-primary py-2.5 text-sm font-bold text-primary-foreground shadow-glow-primary disabled:opacity-50"
                                                >
                                                    {savingPayout ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Save"}
                                                </button>
                                            </div>
                                        </div>
                                    ) : profile.payout_method === "UPI" && profile.bank_upi ? (
                                        <div className="flex items-center gap-3">
                                            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                                                <IndianRupee className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-foreground">{profile.bank_upi}</div>
                                                <div className="text-xs text-muted-foreground">UPI ID</div>
                                            </div>
                                        </div>
                                    ) : profile.payout_method === "BANK" && profile.bank_account_number ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
                                                    <Landmark className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-foreground">
                                                        ••••&nbsp;{profile.bank_account_number.slice(-4)}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {profile.bank_account_name || "Account"} · {profile.bank_ifsc}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-muted-foreground">
                                            No payout method set. Tap <span className="font-bold text-foreground">Edit</span> to add your UPI or bank account.
                                        </div>
                                    )}
                                </div>

                                {/* Logout */}
                                <button
                                    onClick={handleLogout}
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive/10 py-3.5 text-sm font-bold text-destructive"
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

const StatCard = ({
    icon: Icon,
    label,
    value,
}: {
    icon: any;
    label: string;
    value: string;
}) => (
    <div className="rounded-2xl bg-card p-3 shadow-card-soft ring-1 ring-border">
        <div className="mb-2 grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
            <Icon className="h-4 w-4" />
        </div>
        <div className="text-lg font-extrabold text-foreground">{value}</div>
        <div className="text-xs font-bold text-muted-foreground">{label}</div>
    </div>
);


export default Profile;
