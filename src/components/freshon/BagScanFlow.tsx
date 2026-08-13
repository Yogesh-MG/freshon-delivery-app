import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MapPin, Package, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { DeliveryTrip, TripStop } from "@/lib/deliveryTripService";
import {
    BAG_CODE_PREFIX,
    ScannedBag,
    bagCodeForOrder,
    matchBagCode,
    stopRef,
    unverifiedStops,
} from "@/lib/bagCode";
import { QrScanner } from "./QrScanner";

interface Props {
    trip: DeliveryTrip;
    /** Confirms the hub pickup with every bag code read on the way there.
     *  Fired automatically by the last bag scan. */
    onAllScanned: (bags: ScannedBag[]) => void | Promise<void>;
    busy?: boolean;
}

export const BagScanFlow = ({ trip, onAllScanned, busy }: Props) => {
    const [scanningStop, setScanningStop] = useState<TripStop | null>(null);
    // Codes verified against this trip so far. Held on the device until the
    // handover — the backend hears about them once, in the pickup batch.
    const [bags, setBags] = useState<ScannedBag[]>([]);
    // Set only if the auto-confirm came back without the trip moving on, which
    // leaves the rider needing a way to retry.
    const [confirmFailed, setConfirmFailed] = useState(false);

    const dropoffs = trip.stops.filter((s) => s.type === "dropoff");
    const isScanned = (stop: TripStop) => stop.bag_scanned || bags.some((b) => b.stop_id === stop.id);
    const scannedCount = dropoffs.filter(isScanned).length;
    const allScanned = dropoffs.length > 0 && scannedCount === dropoffs.length;
    const nextUnscanned = dropoffs.find((s) => !isScanned(s)) ?? null;

    /**
     * Scanning the last bag IS the handover confirmation — there is nothing left
     * for a separate "confirm pickup" tap to assert, and asking for one just
     * stalls a rider whose hands are full. Fired once per mount; on success the
     * trip flips to ACTIVE and this whole component unmounts.
     */
    const firedRef = useRef(false);
    const mountedRef = useRef(true);
    useEffect(() => () => { mountedRef.current = false; }, []);

    const confirmPickup = () => {
        setConfirmFailed(false);
        // Every order id has to be covered by a scanned code before the handover
        // is worth asserting — the backend checks the same thing on the batch,
        // this just saves a doomed round trip.
        const missing = unverifiedStops(trip.stops, bags);
        if (missing.length > 0) {
            setConfirmFailed(true);
            toast.error(`Handover rejected — scan ${missing.map(stopRef).join(", ")}`);
            return;
        }
        void Promise.resolve(onAllScanned(bags)).finally(() => {
            // Still mounted afterwards means the trip never left ASSIGNED — the
            // confirm was rejected, so surface a retry rather than a dead end.
            if (mountedRef.current) setConfirmFailed(true);
        });
    };

    useEffect(() => {
        if (!allScanned || firedRef.current) return;
        firedRef.current = true;
        confirmPickup();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allScanned]);

    /**
     * A bag code is the order id behind a "D-" prefix, so the code itself says
     * which stop was scanned — whichever row the rider tapped, the bag in their
     * hand decides. Anything that doesn't resolve to an outstanding drop-off on
     * this trip is refused here, before it can count towards the handover.
     */
    const handleScan = (raw: string) => {
        setScanningStop(null);
        const match = matchBagCode(raw, trip.stops, bags);
        if (!match.ok) {
            toast.error(
                match.reason === "malformed"
                    ? `Not a bag code — expected ${BAG_CODE_PREFIX}FRSH-XXXXXX-1`
                    : match.reason === "duplicate"
                        ? `Order ${match.orderId} is already scanned`
                        : `Order ${match.orderId} isn't on this trip`,
            );
            return;
        }

        const next = [...bags, { stop_id: match.stop.id, order_id: match.orderId, code: match.code }];
        setBags(next);
        // The last scan stays quiet — confirming the pickup raises its own toast,
        // and two in a row for one tap reads as a stutter.
        const done = dropoffs.filter((s) => s.bag_scanned || next.some((b) => b.stop_id === s.id)).length;
        if (done < dropoffs.length) toast.success(`Bag scanned · ${done}/${dropoffs.length} done`);
    };

    return (
        <>
            {/* Progress header */}
            <div className="rounded-3xl glass p-4 shadow-card-soft">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                    <ScanLine className="h-3.5 w-3.5" /> Bag scan — hub handover
                </div>
                <div className="mt-1 text-lg font-extrabold tabular-nums text-foreground">
                    {scannedCount} / {dropoffs.length} bags scanned
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: dropoffs.length > 0 ? `${(scannedCount / dropoffs.length) * 100}%` : "0%" }}
                    />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                    {!allScanned
                        ? "Scan each bag's QR — the last one confirms your handover"
                        : confirmFailed
                            ? "All bags verified — handover didn't go through"
                            : "All bags verified — confirming handover…"}
                </div>
            </div>

            {/* Per-bag checklist */}
            <div className="space-y-2">
                {dropoffs.map((stop, i) => {
                    const done = isScanned(stop);
                    const isNext = !done && stop.id === nextUnscanned?.id;
                    return (
                        <div
                            key={stop.id}
                            className={`flex items-center gap-3 rounded-2xl p-3 ring-1 transition-all ${done
                                ? "bg-primary/5 ring-primary/20 opacity-70"
                                : isNext
                                    ? "bg-card ring-primary/60 shadow-card-soft"
                                    : "bg-card ring-border"
                                }`}
                        >
                            <div
                                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-extrabold ${done
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground"
                                    }`}
                            >
                                {done ? <CheckCircle2 className="h-5 w-5" /> : <span>{i + 1}</span>}
                            </div>

                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-bold text-foreground">{stop.order_id || stop.label}</div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{stop.address || stop.label}</span>
                                </div>
                                {(stop.order_id || stop.weight_kg != null) && (
                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                        {[
                                            stop.order_id ? `Order ${stop.order_id}` : null,
                                            stop.weight_kg != null ? `${stop.weight_kg} kg` : null,
                                        ]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </div>
                                )}
                            </div>

                            {!done && (
                                <button
                                    onClick={() => setScanningStop(stop)}
                                    disabled={busy}
                                    aria-label={`Scan bag for ${stop.order_id || stop.label}`}
                                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition active:scale-95 disabled:opacity-50 ${isNext
                                        ? "bg-primary text-primary-foreground shadow-glow-primary"
                                        : "bg-muted text-muted-foreground"
                                        }`}
                                >
                                    <Package className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Scanning is the only action here — the last bag confirms the handover
          by itself, so there is no confirm button unless that call failed. */}
            {!allScanned ? (
                <button
                    onClick={() => setScanningStop(nextUnscanned)}
                    disabled={busy || !nextUnscanned}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-sm font-bold text-primary-foreground shadow-glow-primary transition active:scale-[0.99] disabled:opacity-50"
                >
                    <ScanLine className="h-4 w-4" />
                    {scannedCount + 1 === dropoffs.length
                        ? `Scan last bag · confirms handover`
                        : `Scan bag ${scannedCount + 1} of ${dropoffs.length}`}
                </button>
            ) : confirmFailed ? (
                <button
                    onClick={confirmPickup}
                    disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-amber px-5 py-3.5 text-sm font-bold text-accent-foreground shadow-glow-amber disabled:opacity-60"
                >
                    <CheckCircle2 className="h-4 w-4" />
                    Retry hub handover ({dropoffs.length} orders)
                </button>
            ) : (
                <div className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-soft px-5 py-3.5 text-sm font-bold text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirming handover…
                </div>
            )}

            {scanningStop && (
                <QrScanner
                    title={`Scan bag for stop ${dropoffs.indexOf(scanningStop) + 1}`}
                    // Names the stop, never its code — printing the expected
                    // code on screen would let a rider confirm a bag they never
                    // physically had.
                    hint={`${scanningStop.customer || scanningStop.label} · ${scanningStop.address}`}
                    demoCode={bagCodeForOrder(scanningStop.order_id)}
                    onScan={handleScan}
                    onCancel={() => setScanningStop(null)}
                />
            )}
        </>
    );
};
