import { useState } from "react";
import { CheckCircle2, MapPin, Package, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { DeliveryTrip, DeliveryTripService, TripStop } from "@/lib/deliveryTripService";
import { QrScanner } from "./QrScanner";

interface Props {
  trip: DeliveryTrip;
  onTripUpdate: (trip: DeliveryTrip) => void;
  onAllScanned: () => void;
  busy?: boolean;
}

export const BagScanFlow = ({ trip, onTripUpdate, onAllScanned, busy }: Props) => {
  const [scanningStop, setScanningStop] = useState<TripStop | null>(null);
  const [scanning, setScanning] = useState(false);

  const dropoffs = trip.stops.filter((s) => s.type === "dropoff");
  const scannedCount = dropoffs.filter((s) => s.bag_scanned).length;
  const allScanned = scannedCount === dropoffs.length;
  const nextUnscanned = dropoffs.find((s) => !s.bag_scanned) ?? null;

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
    if (newScanned === total) {
      toast.success("All bags scanned — ready for pickup!");
    } else {
      toast.success(`Bag scanned · ${newScanned}/${total} done`);
    }
  };

  return (
    <>
      {/* Progress header */}
      <div className="rounded-3xl glass p-4 shadow-card-soft">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
          <ScanLine className="h-3.5 w-3.5" /> Bag scan — hub handover
        </div>
        <div className="mt-1 text-lg font-extrabold text-foreground">
          {scannedCount} / {dropoffs.length} bags scanned
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: dropoffs.length > 0 ? `${(scannedCount / dropoffs.length) * 100}%` : "0%" }}
          />
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {allScanned ? "All bags verified — confirm pickup below" : "Scan each bag's QR before leaving the hub"}
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
              className={`flex items-center gap-3 rounded-2xl p-3 ring-1 transition-all ${
                done
                  ? "bg-primary/5 ring-primary/20 opacity-70"
                  : isNext
                  ? "bg-card ring-primary/60 shadow-card-soft"
                  : "bg-card ring-border"
              }`}
            >
              <div
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-extrabold ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <CheckCircle2 className="h-5 w-5" /> : <span>{i + 1}</span>}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-foreground">{stop.customer || stop.label}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{stop.address || stop.label}</span>
                </div>
                {stop.items && stop.items.length > 0 && (
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {stop.items.map((it) => `${it.name} ×${it.qty}`).join(" · ")}
                  </div>
                )}
              </div>

              {!done && (
                <button
                  onClick={() => setScanningStop(stop)}
                  disabled={scanning || busy}
                  className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50 ${
                    isNext
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Package className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Scan next / confirm pickup */}
      {!allScanned ? (
        <button
          onClick={() => setScanningStop(nextUnscanned)}
          disabled={scanning || busy || !nextUnscanned}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-glow-primary disabled:opacity-50"
        >
          <ScanLine className="h-4 w-4" />
          {scanning ? "Processing…" : `Scan bag ${scannedCount + 1} of ${dropoffs.length}`}
        </button>
      ) : (
        <button
          onClick={onAllScanned}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-amber px-5 py-3.5 text-sm font-bold text-accent-foreground shadow-glow-amber disabled:opacity-60"
        >
          <CheckCircle2 className="h-4 w-4" />
          Confirm Hub Pickup ({dropoffs.length} orders)
        </button>
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
