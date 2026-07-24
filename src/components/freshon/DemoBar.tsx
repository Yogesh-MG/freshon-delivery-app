import { useState, useSyncExternalStore } from "react";
import { FlaskConical, Phone, RotateCcw, X } from "lucide-react";
import { isDemoMode, setDemoMode } from "@/lib/demo/demoMode";
import { getStopProbe, subscribeStopProbe } from "@/lib/devProbe";

/**
 * Dev-only control for demo mode — the switch that swaps the real backend for
 * the in-memory one so the rider flow can be walked end to end. Mounted behind
 * `import.meta.env.DEV` in App.tsx, so it never reaches a release bundle.
 */
export const DemoBar = () => {
  const [open, setOpen] = useState(false);
  const on = isDemoMode();
  const probe = useSyncExternalStore(subscribeStopProbe, getStopProbe, () => null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-3 left-3 z-[100] flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold shadow-lg ring-1 ring-black/10 ${
          on ? "bg-amber-400 text-amber-950" : "bg-black/50 text-white/70 backdrop-blur"
        }`}
        aria-label="Demo mode controls"
      >
        <FlaskConical className="h-3.5 w-3.5" />
        {on ? "DEMO" : "dev"}
      </button>
    );
  }

  return (
    <div className="fixed bottom-3 left-3 z-[100] w-60 rounded-2xl bg-black/80 p-3 text-white shadow-xl ring-1 ring-white/10 backdrop-blur">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
          <FlaskConical className="h-3.5 w-3.5" /> Demo mode
        </div>
        <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1 hover:bg-white/10">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="mt-1.5 text-[11px] leading-snug text-white/60">
        Serves the whole rider flow from fake in-memory data. Bag QR and delivery OTP accept anything.
      </p>

      <button
        onClick={() => setDemoMode(!on)}
        className={`mt-2.5 w-full rounded-xl px-3 py-2 text-xs font-bold ${
          on ? "bg-white/15 text-white" : "bg-amber-400 text-amber-950"
        }`}
      >
        {on ? "Turn off (use real API)" : "Turn on demo mode"}
      </button>

      {on && (
        <button
          onClick={() => {
            // A reload re-seeds the fake backend's module state.
            window.location.reload();
          }}
          className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white/80"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset trips
        </button>
      )}

      {/* What the API actually returned for a drop-off. The endpoints are
          auth-gated, so this is the only place the payload shape is visible. */}
      <div className="mt-3 border-t border-white/10 pt-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
          <Phone className="h-3 w-3" /> Drop-off payload
        </div>
        {!probe ? (
          <div className="mt-1 text-[11px] leading-snug text-white/50">
            No trip loaded yet. Go online and open the pool.
          </div>
        ) : (
          <>
            <div
              className={`mt-1 text-[11px] font-bold ${probe.phone ? "text-emerald-300" : "text-amber-300"}`}
            >
              {probe.phone ? `Number: ${probe.phone}` : "No contact number in payload"}
            </div>
            <div className="mt-1 max-h-24 overflow-y-auto break-words text-[10px] leading-snug text-white/45">
              <span className="text-white/30">{probe.source} keys: </span>
              {probe.keys.join(", ")}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
