import { MapApp, NavTarget, openInMapApp } from "@/lib/mapApps";
import { ChevronRight, MapPin, Navigation, X } from "lucide-react";

const APPS: { id: MapApp; name: string; sub: string }[] = [
  { id: "google", name: "Google Maps", sub: "Turn-by-turn navigation" },
  { id: "waze", name: "Waze", sub: "Live traffic & community alerts" },
  { id: "other", name: "Other apps", sub: "Pick another map app" },
];

/**
 * Zomato-style "Navigate with…" sheet. Lets the rider pick which map app to hand
 * the route off to (opens externally via the system opener). Pass `target = null`
 * to keep it closed.
 */
export const NavChooser = ({ target, onClose }: { target: NavTarget | null; onClose: () => void }) => {
  if (!target) return null;

  const pick = (app: MapApp) => {
    openInMapApp(app, target);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 w-full max-w-md rounded-t-[28px] bg-card pb-safe shadow-elevated animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3">
          <div className="h-1.5 w-12 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between px-5 pt-3">
          <div className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-primary" />
            <span className="text-base font-extrabold text-foreground">Navigate with</span>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2 px-5 pb-6 pt-3">
          {APPS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => pick(a.id)}
              className="flex w-full touch-manipulation items-center justify-between rounded-2xl bg-muted/50 p-3 transition active:scale-[.98] hover:bg-muted"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-foreground">{a.name}</div>
                  <div className="text-xs text-muted-foreground">{a.sub}</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
