import { useState, useSyncExternalStore } from "react";
import { Bell, Check, Download, FlaskConical, Phone, Play, RotateCcw, Square, X } from "lucide-react";
import { isDemoMode, setDemoMode } from "@/lib/demo/demoMode";
import { getStopProbe, subscribeStopProbe } from "@/lib/devProbe";
import { dumpApiLog, getApiLogCount, subscribeApiLog } from "@/lib/devApiLog";
import { notify, NOTIFY_ID, requestNotificationPermission } from "@/lib/notify";
import { startBackgroundTracking, stopBackgroundTracking } from "@/lib/bgLocation";

/**
 * Dev-only control for demo mode — the switch that swaps the real backend for
 * the in-memory one so the rider flow can be walked end to end. Mounted behind
 * `import.meta.env.DEV` in App.tsx, so it never reaches a release bundle.
 */
export const DemoBar = () => {
  const [open, setOpen] = useState(false);
  const on = isDemoMode();
  const probe = useSyncExternalStore(subscribeStopProbe, getStopProbe, () => null);
  const apiCount = useSyncExternalStore(subscribeApiLog, getApiLogCount, () => 0);
  const [copied, setCopied] = useState(false);
  const [bgRunning, setBgRunning] = useState(false);

  /**
   * Fire a one-shot OS notification. Tapping this, then locking the phone,
   * confirms notifications land on the lock screen / shade with the screen off.
   */
  const sendTestNotification = async () => {
    await requestNotificationPermission();
    await notify({
      title: "FreshOn test",
      body: "If you can see this on the lock screen, notifications work.",
      id: NOTIFY_ID.test,
    });
  };

  /**
   * Start the native "Delivery in progress" foreground service — the same one a
   * real trip uses. Its persistent notification and location loop survive the
   * screen turning off/on and the app backgrounding, which is what we're testing.
   * The service PATCHes the backend with the current token; in demo mode that
   * call just fails, which is fine — we only care that the service stays alive.
   */
  const startBgTest = async () => {
    await requestNotificationPermission();
    const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) || "https://api.freshon.in";
    const token = localStorage.getItem("freshon_delivery_access") || "demo-token";
    await startBackgroundTracking({
      baseUrl,
      token,
      intervalMs: 30_000,
      notificationTitle: "Delivery in progress",
      notificationBody: "FreshOn is sharing your location for this trip",
    });
    setBgRunning(true);
  };

  const stopBgTest = async () => {
    await stopBackgroundTracking();
    setBgRunning(false);
  };

  /**
   * Hand off the captured traffic. Clipboard first; the console dump is the
   * fallback that always works, including in an Android webview where clipboard
   * permission is unreliable.
   */
  const exportLog = async () => {
    const json = dumpApiLog();
    console.info("─── FreshOn API capture ───\n" + json);
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the console dump above is the payload.
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
        Serves the whole rider flow from fake in-memory data. Bag QR accepts anything, and so does
        the delivery OTP — except 999999, which is refused so the wrong-code path can be walked.
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

      {/* Real request/response captured per endpoint — the only way to see the
          shapes, since everything is auth-gated and there's no public schema. */}
      <div className="mt-3 border-t border-white/10 pt-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
            API capture
          </div>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-black text-white/70">
            {apiCount}
          </span>
        </div>
        <button
          onClick={exportLog}
          disabled={apiCount === 0}
          className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white/80 disabled:opacity-40"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
          {copied ? "Copied + logged" : `Export ${apiCount} endpoint${apiCount === 1 ? "" : "s"}`}
        </button>
      </div>

      {/* Background test — verify notifications and the "Delivery in progress"
          foreground service survive the screen turning off/on. Start it, lock
          the phone, wake it: the persistent notification and location loop
          should still be running. */}
      <div className="mt-3 border-t border-white/10 pt-2.5">
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/50">
          Background test
        </div>
        <button
          onClick={sendTestNotification}
          className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-white/80"
        >
          <Bell className="h-3.5 w-3.5" /> Send test notification
        </button>
        <button
          onClick={bgRunning ? stopBgTest : startBgTest}
          className={`mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${
            bgRunning ? "bg-red-500/80 text-white" : "bg-white/10 text-white/80"
          }`}
        >
          {bgRunning ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {bgRunning ? "Stop delivery-in-progress" : "Start delivery-in-progress"}
        </button>
        <p className="mt-1.5 text-[10px] leading-snug text-white/45">
          Start it, then lock the phone. The persistent notification should stay
          and location keeps reporting until you stop it.
        </p>
      </div>

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
