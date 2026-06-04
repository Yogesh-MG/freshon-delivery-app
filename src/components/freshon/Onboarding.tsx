import { Bike, Car, Truck, Zap } from "lucide-react";
import { useState } from "react";
import { FreshOnLogo } from "./Logo";

const vehicles = [
  { id: "bike", name: "Bicycle", cap: "8 kg", icon: Bike },
  { id: "scooter", name: "E-Scooter", cap: "15 kg", icon: Zap },
  { id: "moto", name: "Motorbike", cap: "25 kg", icon: Car },
  { id: "van", name: "Van", cap: "120 kg", icon: Truck },
];

export const Onboarding = ({ onContinue }: { onContinue: () => void }) => {
  const [pick, setPick] = useState("scooter");
  return (
    <div className="relative min-h-full overflow-hidden">
      <div className="absolute inset-0 -z-10 map-grid opacity-50" />
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-primary/10 to-transparent" />
      <svg className="absolute -z-10 h-full w-full opacity-20" viewBox="0 0 400 700" preserveAspectRatio="none">
        <path d="M-10 600 Q 100 500 200 540 T 410 380" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" className="animate-route" />
        <path d="M-10 200 Q 120 280 240 220 T 410 100" fill="none" stroke="hsl(var(--accent))" strokeWidth="1.5" className="animate-route" />
      </svg>

      <div className="px-6 pt-8">
        <FreshOnLogo />
        <div className="mt-10 animate-fade-up">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Partner App</div>
          <h1 className="mt-2 text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground text-balance">
            Deliver freshness.<br />
            Power the <span className="text-primary">farm-to-table</span> revolution.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Smart routing, live earnings, and priority Swift dispatch — built for couriers on the move.
          </p>
        </div>

        <div className="mt-8 animate-fade-up" style={{ animationDelay: "120ms" }}>
          <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Choose your vehicle</div>
          <div className="grid grid-cols-2 gap-3">
            {vehicles.map((v) => {
              const Icon = v.icon;
              const active = pick === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setPick(v.id)}
                  className={`group relative overflow-hidden rounded-3xl p-4 text-left transition-all
                    ${active
                      ? "bg-gradient-slate text-primary-foreground shadow-elevated -translate-y-0.5"
                      : "bg-card text-foreground ring-1 ring-border hover:ring-primary/40"}`}
                >
                  {active && <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-accent/20 blur-xl" />}
                  <div className={`grid h-10 w-10 place-items-center rounded-2xl
                    ${active ? "bg-white/15 text-accent-glow" : "bg-primary-soft text-primary"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-3 text-sm font-bold">{v.name}</div>
                  <div className={`text-xs ${active ? "opacity-80" : "text-muted-foreground"}`}>Capacity {v.cap}</div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                    <div className={`h-full ${active ? "bg-accent" : "bg-primary/40"}`} style={{ width: active ? "70%" : "30%" }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={onContinue}
          className="mt-8 w-full rounded-2xl bg-gradient-primary px-5 py-4 text-sm font-bold text-primary-foreground shadow-glow-primary transition hover:scale-[1.01] active:scale-[0.99]"
        >
          Activate Partner Mode
        </button>
        <div className="pb-10 pt-3 text-center text-xs text-muted-foreground">
          By continuing you agree to FreshOn's Partner Code of Conduct.
        </div>
      </div>
    </div>
  );
};
