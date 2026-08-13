import { Star } from "lucide-react";

/**
 * Rating tiers, worst first. The badge sits on the green profile card, so the
 * hue has to carry on an opaque pill — coloured text straight on the green
 * makes the top tier invisible and the bottom tier muddy. The pill stays white
 * in both themes for that reason: these three hues need a light ground.
 */
const TIERS = [
    { min: 0, color: "hsl(0 84% 45%)", label: "Needs improvement" },
    { min: 3.5, color: "hsl(32 95% 40%)", label: "Fair" },
    { min: 4.5, color: "hsl(142 72% 30%)", label: "Great" },
] as const;

export const ratingTier = (rating: number) =>
    // Highest tier whose threshold the rating clears; TIERS[0] covers 0 and NaN.
    [...TIERS].reverse().find((t) => rating >= t.min) ?? TIERS[0];

export const RatingBadge = ({ rating, className = "" }: { rating: number; className?: string }) => {
    // The backend can hand back a string or null for a partner with no trips yet.
    const value = Number(rating);
    const known = Number.isFinite(value);
    const tier = ratingTier(known ? value : 0);

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-xs font-extrabold shadow-sm ${className}`}
            style={{ color: known ? tier.color : "hsl(215 16% 47%)" }}
            title={known ? `${value.toFixed(1)} — ${tier.label}` : "No rating yet"}
        >
            <Star className="h-3 w-3 fill-current" />
            {known ? `${value.toFixed(1)} rating` : "No rating yet"}
        </span>
    );
};
