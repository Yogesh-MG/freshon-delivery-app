import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bike,
  Car,
  ChevronRight,
  Edit2,
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
import { FreshOnLogo } from "@/components/freshon/Logo";
import { DeliveryPartnerService, DeliveryPartnerProfile } from "@/lib/deliveryPartnerService";
import { backendAuthService } from "@/lib/backendAuthService";
import { useAuth } from "@/hooks/useAuth";

const VEHICLE_ICONS = {
  BIKE: Car,
  SCOOTER: Zap,
  CYCLE: Bike,
  VAN: Truck,
};

const VEHICLE_NAMES = {
  BIKE: "Motorbike",
  SCOOTER: "E-Scooter",
  CYCLE: "Bicycle",
  VAN: "Van",
};

const Profile = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<DeliveryPartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    vehicle_type: "BIKE" as "BIKE" | "SCOOTER" | "CYCLE" | "VAN",
    vehicle_number: "",
    address: "",
    city: "",
    pincode: "",
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
        vehicle_type: result.data.vehicle_type,
        vehicle_number: result.data.vehicle_number,
        address: result.data.address || "",
        city: result.data.city || "",
        pincode: result.data.pincode || "",
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
    <main className="min-h-screen">
      <PhoneFrame>
        <div className="flex h-full flex-col">
          {/* Header */}
          <header className="flex items-center justify-between px-5 pt-6">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1 rounded-2xl bg-card px-3 py-2 text-sm font-semibold text-foreground ring-1 ring-border"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <FreshOnLogo />
            <button
              onClick={handleLogout}
              className="grid h-10 w-10 place-items-center rounded-2xl bg-card ring-1 ring-border"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4 text-foreground" />
            </button>
          </header>

          {/* Content */}
          <div className="flex-1 space-y-4 px-5 pb-24 pt-5">
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
                        {profile.rating.toFixed(1)} rating
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
                        <div className="grid grid-cols-4 gap-2">
                          {(Object.keys(VEHICLE_NAMES) as Array<keyof typeof VEHICLE_NAMES>).map((type) => {
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
                            const Icon = VEHICLE_ICONS[profile.vehicle_type];
                            return <Icon className="h-5 w-5" />;
                          })()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-foreground">
                            {VEHICLE_NAMES[profile.vehicle_type]}
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

                {/* Quick Actions */}
                <div className="rounded-3xl bg-card p-4 shadow-card-soft ring-1 ring-border">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                    Quick Actions
                  </h3>
                  <div className="space-y-2">
                    <ActionButton
                      icon={Package}
                      label="View Earnings"
                      onClick={() => navigate("/earnings")}
                    />
                    <ActionButton
                      icon={User}
                      label="Complete KYC"
                      onClick={() => navigate("/onboarding")}
                    />
                  </div>
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

const ActionButton = ({
  icon: Icon,
  label,
  onClick,
}: {
  icon: any;
  label: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex w-full items-center justify-between rounded-xl bg-muted/50 p-3 transition hover:bg-muted"
  >
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-sm font-bold text-foreground">{label}</span>
    </div>
    <ChevronRight className="h-4 w-4 text-muted-foreground" />
  </button>
);

export default Profile;
