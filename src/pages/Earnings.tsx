import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  Calendar,
  Clock,
  IndianRupee,
  Landmark,
  Loader2,
  MapPin,
  Package,
  Star,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { PhoneFrame } from "@/components/freshon/PhoneFrame";
import { Wordmark } from "@/components/freshon/Wordmark";
import { BottomNav } from "@/components/freshon/BottomNav";
import { DeliveryPartnerService, EarningsHistory, DailyEarning, DeliveryPartnerProfile } from "@/lib/deliveryPartnerService";
import { DeliveryWalletService, WalletSummary, Withdrawal, WithdrawMethod } from "@/lib/deliveryWalletService";

const PERIOD_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 3 months" },
];

const Earnings = () => {
  const [history, setHistory] = useState<EarningsHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  // Wallet
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [profile, setProfile] = useState<DeliveryPartnerProfile | null>(null);
  const [showWithdraw, setShowWithdraw] = useState(false);

  useEffect(() => {
    loadEarnings();
  }, [days]);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    const [w, wl, p] = await Promise.all([
      DeliveryWalletService.getWallet(),
      DeliveryWalletService.getWithdrawals(),
      DeliveryPartnerService.getProfile(),
    ]);
    if (w.success && w.data) setWallet(w.data);
    if (wl.success && wl.data) setWithdrawals(wl.data);
    if (p.success && p.data) setProfile(p.data);
  };

  const loadEarnings = async () => {
    setLoading(true);
    const result = await DeliveryPartnerService.getEarningsHistory(days);
    if (result.success && result.data) {
      setHistory(result.data);
    } else {
      toast.error(result.error || "Failed to load earnings");
    }
    setLoading(false);
  };


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const submitWithdraw = async (amount: number, method: WithdrawMethod) => {
    const res = await DeliveryWalletService.requestWithdrawal(amount, method);
    if (res.success) {
      toast.success("Withdrawal requested");
      setShowWithdraw(false);
      loadWallet();
    } else {
      toast.error(res.error || "Withdrawal failed");
    }
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
              <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Earnings</h2>
              <p className="text-sm text-muted-foreground">Track your income and performance</p>
            </div>

            {/* Wallet */}
            {wallet && (
              <div className="overflow-hidden rounded-3xl bg-gradient-slate p-5 text-primary-foreground shadow-elevated">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] opacity-80">
                  <Wallet className="h-3.5 w-3.5" /> Wallet balance
                </div>
                <div className="mt-1 text-3xl font-extrabold tracking-tight">
                  {formatCurrency(parseFloat(wallet.available))}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs opacity-80">
                  {parseFloat(wallet.pending) > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatCurrency(parseFloat(wallet.pending))} maturing
                      {wallet.next_matures_at ? ` · ${maturesIn(wallet.next_matures_at)}` : ""}
                    </span>
                  )}
                  <span>Withdrawn {formatCurrency(parseFloat(wallet.total_withdrawn))}</span>
                </div>
                <button
                  onClick={() => setShowWithdraw(true)}
                  disabled={parseFloat(wallet.available) <= 0}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-glow-primary disabled:opacity-50"
                >
                  <ArrowDownToLine className="h-4 w-4" /> Withdraw
                </button>
                <p className="mt-2 text-center text-[11px] opacity-70">
                  Earnings can be withdrawn {wallet.hold_hours}h after delivery.
                </p>
              </div>
            )}

            {/* Period Selector */}
            <div className="flex gap-2">
              {PERIOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDays(option.value)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                    days === option.value
                      ? "bg-gradient-primary text-primary-foreground shadow-glow-primary"
                      : "bg-card text-muted-foreground ring-1 ring-border"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="grid place-items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : history ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-3">
                  <SummaryCard
                    icon={IndianRupee}
                    label="Total Earnings"
                    value={formatCurrency(history.summary.total_earnings)}
                    trend={`${history.summary.total_deliveries} deliveries`}
                    color="primary"
                  />
                  <SummaryCard
                    icon={Star}
                    label="Rating"
                    value={history.lifetime.rating.toFixed(1)}
                    trend="Lifetime"
                    color="amber"
                  />
                  <SummaryCard
                    icon={Package}
                    label="Deliveries"
                    value={history.summary.total_deliveries.toString()}
                    trend={`${history.summary.total_distance.toFixed(1)} km`}
                    color="green"
                  />
                  <SummaryCard
                    icon={TrendingUp}
                    label="Lifetime"
                    value={formatCurrency(history.lifetime.total_earnings)}
                    trend={`${history.lifetime.total_deliveries} total`}
                    color="blue"
                  />
                </div>

                {/* Daily Breakdown */}
                <div className="rounded-3xl bg-card p-4 shadow-card-soft ring-1 ring-border">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      Daily Breakdown
                    </h3>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {history.daily_breakdown.length > 0 ? (
                      history.daily_breakdown.map((day) => (
                        <DayRow key={day.date} day={day} formatCurrency={formatCurrency} formatDate={formatDate} />
                      ))
                    ) : (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        No earnings in this period
                      </p>
                    )}
                  </div>
                </div>

                {/* Recent Deliveries */}
                <div className="rounded-3xl bg-card p-4 shadow-card-soft ring-1 ring-border">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                      Recent Deliveries
                    </h3>
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    {history.recent_deliveries.length > 0 ? (
                      history.recent_deliveries.map((delivery) => (
                        <div
                          key={delivery.id}
                          className="flex items-center justify-between rounded-xl bg-muted/50 p-3"
                        >
                          <div>
                            <div className="text-sm font-bold text-foreground">
                              {formatCurrency(delivery.earnings)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(delivery.date)} · {delivery.service}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {delivery.distance.toFixed(1)} km
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        No recent deliveries
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : null}

            {/* Withdrawals history */}
            {withdrawals.length > 0 && (
              <div className="rounded-3xl bg-card p-4 shadow-card-soft ring-1 ring-border">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Withdrawals</h3>
                  <ArrowDownToLine className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  {withdrawals.map((w) => (
                    <div key={w.id} className="flex items-center justify-between rounded-xl bg-muted/50 p-3">
                      <div>
                        <div className="text-sm font-bold text-foreground">{formatCurrency(parseFloat(w.amount))}</div>
                        <div className="text-xs text-muted-foreground">
                          {w.method === "UPI" ? w.upi_id : `••• ${w.bank_account_number.slice(-4)}`} · {formatDate(w.requested_at)}
                        </div>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${WITHDRAWAL_BADGE[w.status]}`}>
                        {w.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          <BottomNav active="earnings" />
        </div>
      </PhoneFrame>

      {showWithdraw && wallet && (
        <WithdrawSheet
          available={parseFloat(wallet.available)}
          profile={profile}
          onClose={() => setShowWithdraw(false)}
          onSubmit={submitWithdraw}
        />
      )}
    </main>
  );
};

const WITHDRAWAL_BADGE: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-600",
  PROCESSING: "bg-blue-500/10 text-blue-600",
  PAID: "bg-green-500/10 text-green-600",
  REJECTED: "bg-red-500/10 text-red-600",
  CANCELLED: "bg-muted text-muted-foreground",
};

function maturesIn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "ready";
  const h = Math.floor(ms / 3600000);
  if (h >= 1) return `in ${h}h`;
  const m = Math.max(1, Math.floor(ms / 60000));
  return `in ${m}m`;
}

const WithdrawSheet = ({
  available,
  profile,
  onClose,
  onSubmit,
}: {
  available: number;
  profile: DeliveryPartnerProfile | null;
  onClose: () => void;
  onSubmit: (amount: number, method: WithdrawMethod) => Promise<void>;
}) => {
  const hasUpi = !!profile?.bank_upi;
  const hasBank = !!(profile?.bank_account_number && profile?.bank_ifsc);
  const [method, setMethod] = useState<WithdrawMethod | "">(hasUpi ? "UPI" : hasBank ? "BANK" : "");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const inr = (n: number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    if (amt > available) return;
    if (method !== "UPI" && method !== "BANK") return;
    setBusy(true);
    await onSubmit(amt, method);
    setBusy(false);
  };

  const noMethod = !hasUpi && !hasBank;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 w-full max-w-md rounded-t-[28px] bg-card pb-safe shadow-elevated animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3"><div className="h-1.5 w-12 rounded-full bg-border" /></div>
        <div className="flex items-center justify-between px-5 pt-3">
          <span className="text-base font-extrabold text-foreground">Withdraw earnings</span>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 pb-6 pt-2">
          <div className="text-xs text-muted-foreground">Available: <span className="font-bold text-foreground">{inr(available)}</span></div>

          {noMethod ? (
            <div className="rounded-2xl bg-muted/50 p-4 text-center text-sm text-muted-foreground">
              Add a UPI ID or bank account in your Profile before withdrawing.
            </div>
          ) : (
            <>
              <div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-bold text-muted-foreground">₹</span>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                    placeholder="0"
                    inputMode="decimal"
                    className="w-full rounded-2xl border border-border bg-background py-3 pl-8 pr-16 text-lg font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <button
                    type="button"
                    onClick={() => setAmount(String(available))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-muted px-2.5 py-1 text-xs font-bold text-foreground"
                  >
                    Max
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {hasUpi && (
                  <button
                    type="button"
                    onClick={() => setMethod("UPI")}
                    className={`flex min-h-[56px] flex-col items-start justify-center gap-0.5 rounded-2xl p-3 text-left transition ${method === "UPI" ? "bg-gradient-primary text-primary-foreground shadow-glow-primary" : "bg-muted text-muted-foreground"}`}
                  >
                    <span className="flex items-center gap-1 text-xs font-bold"><IndianRupee className="h-3.5 w-3.5" /> UPI</span>
                    <span className="truncate text-[11px] opacity-90">{profile?.bank_upi}</span>
                  </button>
                )}
                {hasBank && (
                  <button
                    type="button"
                    onClick={() => setMethod("BANK")}
                    className={`flex min-h-[56px] flex-col items-start justify-center gap-0.5 rounded-2xl p-3 text-left transition ${method === "BANK" ? "bg-gradient-primary text-primary-foreground shadow-glow-primary" : "bg-muted text-muted-foreground"}`}
                  >
                    <span className="flex items-center gap-1 text-xs font-bold"><Landmark className="h-3.5 w-3.5" /> Bank</span>
                    <span className="truncate text-[11px] opacity-90">••• {profile?.bank_account_number.slice(-4)}</span>
                  </button>
                )}
              </div>

              <button
                onClick={submit}
                disabled={busy || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > available || !method}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow-primary disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" />}
                Request withdrawal
              </button>
              <p className="text-center text-[11px] text-muted-foreground">
                Paid to your selected {method === "BANK" ? "bank account" : "UPI"} after review.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const SummaryCard = ({
  icon: Icon,
  label,
  value,
  trend,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  trend: string;
  color: "primary" | "amber" | "green" | "blue";
}) => {
  const colorClasses = {
    primary: "bg-primary-soft text-primary",
    amber: "bg-amber-500/10 text-amber-600",
    green: "bg-green-500/10 text-green-600",
    blue: "bg-blue-500/10 text-blue-600",
  };

  return (
    <div className="rounded-2xl bg-card p-3 shadow-card-soft ring-1 ring-border">
      <div className={`mb-2 grid h-8 w-8 place-items-center rounded-xl ${colorClasses[color]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-lg font-extrabold text-foreground">{value}</div>
      <div className="text-xs font-bold text-muted-foreground">{label}</div>
      <div className="mt-1 text-[10px] text-muted-foreground">{trend}</div>
    </div>
  );
};

const DayRow = ({
  day,
  formatCurrency,
  formatDate,
}: {
  day: DailyEarning;
  formatCurrency: (n: number) => string;
  formatDate: (s: string) => string;
}) => (
  <div className="flex items-center justify-between rounded-xl bg-muted/50 p-3">
    <div>
      <div className="text-sm font-bold text-foreground">{formatDate(day.date)}</div>
      <div className="text-xs text-muted-foreground">{day.deliveries} deliveries · {day.distance.toFixed(1)} km</div>
    </div>
    <div className="text-sm font-extrabold text-primary">{formatCurrency(day.earnings)}</div>
  </div>
);

export default Earnings;
