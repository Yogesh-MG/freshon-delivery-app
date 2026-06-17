import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  IndianRupee,
  MapPin,
  Package,
  Star,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { PhoneFrame } from "@/components/freshon/PhoneFrame";
import { FreshOnLogo } from "@/components/freshon/Logo";
import { DeliveryPartnerService, EarningsHistory, DailyEarning } from "@/lib/deliveryPartnerService";

const PERIOD_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 3 months" },
];

const Earnings = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<EarningsHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadEarnings();
  }, [days]);

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

  return (
    <main className="h-dvh overflow-hidden">
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
            <div className="w-10" />
          </header>

          {/* Content */}
          <div className="flex-1 overflow-y-auto space-y-4 px-5 pb-8 pt-5">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Earnings</h2>
              <p className="text-sm text-muted-foreground">Track your income and performance</p>
            </div>

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
          </div>
        </div>
      </PhoneFrame>
    </main>
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
