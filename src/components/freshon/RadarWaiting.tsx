// Fixed contact positions, as a % of the radar box. Deliberately deterministic
// so the blips don't jump around on every re-render — they read as real orders
// sitting in the pool, not noise. Kept inside ~20–80% so they land between the
// centre dot and the outer ring.
const BLIP_SPOTS = [
    { x: 72, y: 30 },
    { x: 28, y: 40 },
    { x: 62, y: 71 },
    { x: 33, y: 66 },
    { x: 79, y: 56 },
    { x: 21, y: 58 },
];

/**
 * Idle state for the home screen. `count` is how many trips are sitting in the
 * available pool — each one shows up as a green contact on the sweep.
 */
export const RadarWaiting = ({ count = 0 }: { count?: number }) => {
    const blips = BLIP_SPOTS.slice(0, Math.min(count, BLIP_SPOTS.length));

    return (
        <div className="relative overflow-hidden rounded-3xl glass p-6 text-center shadow-card-soft">
            <div className="relative mx-auto h-32 w-32">
                <div className="absolute inset-0 grid place-items-center">
                    <div className="h-3 w-3 rounded-full bg-primary shadow-glow-primary" />
                </div>
                {[0, 0.6, 1.2].map((d, i) => (
                    <div
                        key={i}
                        className="absolute inset-0 rounded-full border-2 border-primary/40 animate-radar"
                        style={{ animationDelay: `${d}s` }}
                    />
                ))}
                {blips.map((p, i) => (
                    <span
                        key={i}
                        className="absolute h-2.5 w-2.5 rounded-full bg-primary shadow-glow-primary animate-blip"
                        style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${i * 0.35}s` }}
                    />
                ))}
            </div>
            <div className="mt-3 text-sm font-semibold text-foreground">
                {count > 0 ? `${count} order${count > 1 ? "s" : ""} nearby` : "Scanning the city"}
            </div>
            <div className="text-xs text-muted-foreground">
                {count > 0 ? "Go online to start accepting" : "Listening for nearby orders…"}
            </div>
        </div>
    );
};
