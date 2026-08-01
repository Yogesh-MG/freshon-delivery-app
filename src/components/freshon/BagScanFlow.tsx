import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MapPin, Package, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { DeliveryTrip, DeliveryTripService, TripStop } from "@/lib/deliveryTripService";
import { QrScanner } from "./QrScanner";

interface Props {
    trip: DeliveryTrip;
    onTripUpdate: (trip: DeliveryTrip) => void;
    /** Confirms the hub pickup. Fired automatically by the last bag scan. */
    onAllScanned: () => void | Promise<void>;
    busy?: boolean;
}

export const BagScanFlow = ({ trip, onTripUpdate, onAllScanned, busy }: Props) => {
    const [scanningStop, setScanningStop] = useState<TripStop | null>(null);
    const [scanning, setScanning] = useState(false);
    // Set only if the auto-confirm came back without the trip moving on, which
    // leaves the rider needing a way to retry.
    const [confirmFailed, setConfirmFailed] = useState(false);

    const dropoffs = trip.stops.filter((s) => s.type === "dropoff");
    const scannedCount = dropoffs.filter((s) => s.bag_scanned).length;
    const allScanned = dropoffs.length > 0 && scannedCount === dropoffs.length;
    const nextUnscanned = dropoffs.find((s) => !s.bag_scanned) ?? null;

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
        void Promise.resolve(onAllScanned()).finally(() => {
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

    const handleScan = async (code: string) => {
        setScanningStop(null);
        setScanning(true);
        const result = await DeliveryTripService.scanBag(trip.id, code);
        setScanning(false);
        if (!result.success || !result.data) {
            toast.error(result.error || "Scan failed — try again");
            return;
        }
        onTripUpdate(result.data);
        const newScanned = result.data.stops.filter((s) => s.type === "dropoff" && s.bag_scanned).length;
        const total = result.data.stops.filter((s) => s.type === "dropoff").length;
        // The last scan stays quiet — confirming the pickup raises its own toast,
        // and two in a row for one tap reads as a stutter.
        if (newScanned < total) toast.success(`Bag scanned · ${newScanned}/${total} done`);
    };

    return (
        <>
            {/* Progress header */}
            <div className="rounded-3xl glass p-4 shadow-card-soft">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
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
                    const done = stop.bag_scanned;
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
                                    disabled={scanning || busy}
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
                    disabled={scanning || busy || !nextUnscanned}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-sm font-bold text-primary-foreground shadow-glow-primary transition active:scale-[0.99] disabled:opacity-50"
                >
                    <ScanLine className="h-4 w-4" />
                    {scanning
                        ? "Processing…"
                        : scannedCount + 1 === dropoffs.length
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
                    hint={`${scanningStop.customer || scanningStop.label} · ${scanningStop.address}`}
                    onScan={handleScan}
                    onCancel={() => setScanningStop(null)}
                />
            )}
        </>
    );
};
