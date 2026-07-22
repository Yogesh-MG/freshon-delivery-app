/**
 * Text-only brand mark used across the partner screens (sign-in, onboarding,
 * home). Deliberately icon-free — the only place a glyph appears is the bike
 * tile the sign-in screen stacks above it.
 */
export const Wordmark = ({ size = "sm" }: { size?: "sm" | "lg" }) => (
    <div className="text-center">
        <div className={`font-extrabold tracking-tight text-foreground ${size === "lg" ? "text-2xl" : "text-xl"}`}>
            FreshOn<span className="text-primary"> Go</span>
        </div>
        <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Partner</div>
    </div>
);
