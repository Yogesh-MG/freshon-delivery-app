import { Home, MapPin } from "lucide-react";

export type RouteDest = "hub" | "dropoff";

/**
 * Segmented control that picks which leg the on-screen map draws.
 *
 * This is a VIEW control only. The rider's own position is always the origin, so
 * "Hub" means "show me the way to the pickup" and "Delivery"/"Stops" means "show
 * me the way to the customer". It deliberately does NOT retarget the external
 * Google Maps hand-off — that stays gated on the hub bag scan, so a rider can
 * look ahead at the drop-off route without being able to navigate away from the
 * hub before every bag is accounted for.
 *
 * Disabled options render greyed rather than hidden, so the control keeps its
 * width and doesn't reflow the map header between stages.
 */
export const RouteToggle = ({
  value,
  onChange,
  hubEnabled = true,
  dropoffEnabled = true,
  dropoffLabel = "Delivery",
  className,
}: {
  value: RouteDest;
  onChange: (next: RouteDest) => void;
  hubEnabled?: boolean;
  dropoffEnabled?: boolean;
  dropoffLabel?: string;
  className?: string;
}) => {
  const options: { key: RouteDest; label: string; icon: typeof Home; enabled: boolean }[] = [
    { key: "hub", label: "Hub", icon: Home, enabled: hubEnabled },
    { key: "dropoff", label: dropoffLabel, icon: MapPin, enabled: dropoffEnabled },
  ];

  return (
    <div
      role="group"
      aria-label="Map destination"
      className={`flex items-center gap-1 rounded-2xl bg-muted/60 p-1 ${className || ""}`}
    >
      {options.map(({ key, label, icon: Icon, enabled }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            disabled={!enabled}
            aria-pressed={active}
            onClick={() => enabled && onChange(key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors active:scale-[0.98] disabled:opacity-40 ${
              active ? "bg-card text-foreground shadow-card-soft" : "text-muted-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
};
