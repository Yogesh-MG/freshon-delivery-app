import { useRef, useState } from "react";
import { Loader2, Power, Zap } from "lucide-react";

/**
 * The go-online switch.
 *
 * Going online is not instant: the tap triggers the Android location and
 * notification prompts, then a GPS fix that can take eight seconds, then a
 * status write, then the dashboard fetch. All of that used to happen behind a
 * button that looked exactly the same throughout, so a rider tapped it, saw
 * nothing change, and tapped again — or assumed the app was broken.
 *
 * `pending` covers that whole span, from the tap to the data landing on screen.
 */
export const StatusToggle = ({
    online,
    pending = false,
    onChange,
}: {
    online: boolean;
    /** True from the tap until the dashboard has finished loading. */
    pending?: boolean;
    onChange: (v: boolean) => void;
}) => {
    const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
    const idRef = useRef(0);

    const fire = (e: React.MouseEvent) => {
        if (pending) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const id = ++idRef.current;
        setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
        setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), 900);
        onChange(!online);
    };

    // What the app is doing, in the rider's terms. "Going online" covers the
    // permission prompts and the GPS fix; "Getting you set up" covers the fetch
    // after the status write, which is the longest and least visible part.
    const headline = pending
        ? online
            ? "Getting you set up…"
            : "Going offline…"
        : online
            ? "You're on the grid"
            : "Tap to Go Online";

    const status = pending
        ? online
            ? "Loading your missions"
            : "Signing off"
        : online
            ? "Online · Accepting Missions"
            : "Offline";

    return (
        <button
            onClick={fire}
            disabled={pending}
            aria-busy={pending}
            aria-label={online ? "Go offline" : "Go online"}
            className={`relative w-full overflow-hidden rounded-3xl p-5 text-left transition-all duration-500
        ${online
                    ? "bg-primary text-primary-foreground"
                    : "glass-dark text-secondary-foreground"}
        ${online && !pending ? "animate-glow-pulse" : ""}
        ${pending ? "cursor-wait opacity-95" : ""}`}
        >
            {ripples.map((r) => (
                <span
                    key={r.id}
                    className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40 animate-ripple"
                    style={{ left: r.x, top: r.y }}
                />
            ))}

            {/* A solid band travelling across the control, so the wait reads at
                a glance from a handlebar mount — the small spinner alone is easy
                to miss in daylight. */}
            {pending && (
                <span className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-status-sweep bg-white/12" />
            )}

            <div className="relative z-10 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] opacity-80">
                        {pending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : online ? (
                            <Zap className="h-3.5 w-3.5" />
                        ) : (
                            <Power className="h-3.5 w-3.5" />
                        )}
                        <span className="truncate">{status}</span>
                    </div>
                    <div className="mt-1 text-2xl font-extrabold tracking-tight">{headline}</div>
                </div>

                <div
                    className={`grid h-14 w-14 shrink-0 place-items-center rounded-full transition-all
          ${online ? "bg-white/20" : "bg-white/10"}`}
                >
                    {pending ? (
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                    ) : (
                        <div
                            className={`h-3 w-3 rounded-full ${online ? "bg-accent animate-amber-pulse" : "bg-white/50"}`}
                        />
                    )}
                </div>
            </div>
        </button>
    );
};
