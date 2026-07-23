import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Clock, IndianRupee, Loader2, Lock, Package, Route, ShieldCheck } from "lucide-react";
import { PhoneFrame } from "@/components/freshon/PhoneFrame";
import { Wordmark } from "@/components/freshon/Wordmark";
import { BottomNav } from "@/components/freshon/BottomNav";
import { StatusToggle } from "@/components/freshon/StatusToggle";
import { EarningsHeader } from "@/components/freshon/EarningsHeader";
import { MissionCard } from "@/components/freshon/MissionCard";
import { RadarWaiting } from "@/components/freshon/RadarWaiting";
import { LoadMeter } from "@/components/freshon/LoadMeter";
import { DeliveryMap } from "@/components/freshon/DeliveryMap";
import { TripView } from "@/components/freshon/TripView";
import { RouteList } from "@/components/freshon/RouteList";
import { FeeBreakdown } from "@/components/freshon/FeeBreakdown";
import { ProofDrawer } from "@/components/freshon/ProofDrawer";
import { QrScanner } from "@/components/freshon/QrScanner";
import { RouteToggle, RouteDest } from "@/components/freshon/RouteToggle";
import { play } from "@/lib/sound";
import { requestNotificationPermission } from "@/lib/notify";
import { Assignment, EarningsStats, Stop } from "@/lib/types";
import { DeliveryAssignmentService } from "@/lib/deliveryAssignmentService";
import { DeliveryStatusService } from "@/lib/deliveryStatusService";
import { DeliveryPartnerService } from "@/lib/deliveryPartnerService";
import { DeliveryTrip, DeliveryTripService, TripStop } from "@/lib/deliveryTripService";
import { useDeliverySocket } from "@/hooks/useDeliverySocket";
import { TripOffer } from "@/components/freshon/TripOffer";

const emptyStats: EarningsStats = {
  earnings: 0,
  goal: 1500,
  deliveries: 0,
  distance: 0,
  rating: 5,
};

// Pull-to-refresh geometry, in px of finger travel (already damped).
const PULL_THRESHOLD = 64;
const PULL_MAX = 96;

/**
 * Drag-down-to-refresh on a scroll container. Listeners are attached natively
 * because React registers `touchmove` as passive, which would forbid the
 * preventDefault() we need to stop the browser's own overscroll.
 */
const usePullToRefresh = (
  scrollRef: React.RefObject<HTMLDivElement>,
  onRefresh: () => Promise<void>,
) => {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // Mirror of `pull` readable from the native handlers without re-registering.
  const pullRef = useRef(0);
  const busyRef = useRef(false);
  const handlerRef = useRef(onRefresh);
  handlerRef.current = onRefresh;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let startY = 0;
    let tracking = false;

    const setPullValue = (value: number) => {
      pullRef.current = value;
      setPull(value);
    };

    const start = (e: TouchEvent) => {
      if (el.scrollTop > 0 || busyRef.current) return;
      startY = e.touches[0].clientY;
      tracking = true;
    };

    const move = (e: TouchEvent) => {
      if (!tracking) return;
      const delta = e.touches[0].clientY - startY;
      // Dragging back up, or the list scrolled away under the finger — hand
      // control back to normal scrolling.
      if (delta <= 0 || el.scrollTop > 0) {
        tracking = false;
        setPullValue(0);
        return;
      }
      e.preventDefault();
      setPullValue(Math.min(PULL_MAX, delta * 0.5));
    };

    const end = async () => {
      if (!tracking) return;
      tracking = false;
      const released = pullRef.current;
      if (released < PULL_THRESHOLD) {
        setPullValue(0);
        return;
      }
      busyRef.current = true;
      setRefreshing(true);
      setPullValue(PULL_THRESHOLD);
      try {
        await handlerRef.current();
      } finally {
        busyRef.current = false;
        setRefreshing(false);
        setPullValue(0);
      }
    };

    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [scrollRef]);

  return { pull, refreshing };
};

const Index = () => {
  const navigate = useNavigate();

  // Read the JWT that apiClient keeps in localStorage — reuse it for WS auth.
  const wsToken = typeof localStorage !== "undefined"
    ? localStorage.getItem("freshon_delivery_access")
    : null;
  const { offeredTrip, claimTrip, dismissOffer } = useDeliverySocket(wsToken);

  const [online, setOnline] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [completedStopIds, setCompletedStopIds] = useState<Set<string>>(new Set());
  const [earnings, setEarnings] = useState<EarningsStats>(emptyStats);
  const [openStop, setOpenStop] = useState<Stop | null>(null);
  const [pickupScanStop, setPickupScanStop] = useState<Stop | null>(null);
  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState<DeliveryTrip | null>(null);
  const [availableTrips, setAvailableTrips] = useState<DeliveryTrip[]>([]);
  const [riderPos, setRiderPos] = useState<{ latitude: number; longitude: number } | null>(null);
  const [tripBusy, setTripBusy] = useState(false);
  // KYC/verification gate — a partner can only go online once every required
  // document is uploaded AND approved by ops.
  const [verification, setVerification] = useState<{
    isComplete: boolean;
    allVerified: boolean;
    anyRejected: boolean;
    uploaded: number;
    required: number;
  } | null>(null);
  const isVerified = verification?.allVerified ?? false;

  const scrollRef = useRef<HTMLDivElement>(null);

  const activeMission = useMemo(() => {
    return assignments.find((assignment) => assignment.id === activeAssignmentId)
      || assignments.find((assignment) => assignment.status !== "PENDING")
      || assignments[0]
      || null;
  }, [activeAssignmentId, assignments]);

  // The leg the rider has actually reached. This gates the external Navigate
  // hand-off — until the handover QR is scanned, navigation points at the hub.
  const missionStageDest: RouteDest =
    activeMission?.status === "PICKED_UP" || activeMission?.status === "IN_TRANSIT"
      ? "dropoff"
      : "hub";

  // What the on-screen map draws. Free for the rider to flip so they can preview
  // the drop-off leg while still at the hub; defaults to wherever they are in the
  // flow, and re-syncs when the stage or mission changes.
  const [routeDest, setRouteDest] = useState<RouteDest>("hub");
  useEffect(() => {
    setRouteDest(missionStageDest);
  }, [missionStageDest, activeMission?.id]);

  /**
   * Work that pins the rider online. Going offline mid-delivery would strand a
   * customer's order with no assigned rider, so the status toggle is blocked
   * (and, once the goods are physically in hand, hidden entirely).
   */
  const tripInProgress = !!trip && trip.status !== "COMPLETED" && trip.status !== "CANCELLED";
  const missionInProgress =
    !!activeMission && activeMission.status !== "PENDING" && activeMission.status !== "DELIVERED";

  /**
   * True from the moment work is accepted until it completes or is cancelled.
   * While set, the online/offline control and the earnings header are hidden —
   * the screen is only about running the trip. Cancelling or finishing clears
   * this and both come straight back.
   */
  const hasActiveWork = tripInProgress || missionInProgress;

  const refreshDashboard = async () => {
    const [assignmentResult, earningsResult, tripResult, availableResult, kycResult] = await Promise.all([
      DeliveryAssignmentService.getAssignments(),
      DeliveryStatusService.getEarnings(),
      DeliveryTripService.getActiveTrip(),
      DeliveryTripService.getAvailableTrips(),
      DeliveryPartnerService.getKycDocuments(),
    ]);

    if (kycResult.success && kycResult.data) {
      const docs = kycResult.data.documents;
      const ks = kycResult.data.kyc_status;
      setVerification({
        isComplete: ks.is_complete,
        allVerified: ks.is_complete && docs.length > 0 && docs.every((d) => d.status === "verified"),
        anyRejected: docs.some((d) => d.status === "rejected"),
        uploaded: ks.uploaded_count,
        required: ks.required_count,
      });
    }

    if (assignmentResult.success) {
      const nextAssignments = assignmentResult.data || [];
      setAssignments(nextAssignments);
      setActiveAssignmentId((current) => current || nextAssignments.find((a) => a.status !== "PENDING")?.id || nextAssignments[0]?.id || null);
    } else {
      toast.error(assignmentResult.error || "Unable to load assignments");
    }

    if (earningsResult.success && earningsResult.data) {
      setEarnings(earningsResult.data);
    }

    if (tripResult.success) setTrip(tripResult.data ?? null);
    if (availableResult.success) setAvailableTrips(availableResult.data || []);

    setLoading(false);
  };

  const { pull, refreshing } = usePullToRefresh(scrollRef, refreshDashboard);

  useEffect(() => {
    refreshDashboard();
    // Seed the map with the rider's own position so it isn't blank while idle.
    getCurrentCoords().then((coords) => coords && setRiderPos(coords));
  }, []);

  const acceptTrip = async (tripToAccept: DeliveryTrip) => {
    setTripBusy(true);
    const result = await DeliveryTripService.acceptTrip(tripToAccept.id);
    setTripBusy(false);
    if (!result.success || !result.data) {
      toast.error(result.error || "Unable to accept trip");
      play("error");
      return;
    }
    setTrip(result.data);
    setAvailableTrips((current) => current.filter((t) => t.id !== tripToAccept.id));
    toast.success("Trip accepted");
    play("success");
  };

  const confirmTripPickup = async () => {
    if (!trip) return;
    setTripBusy(true);
    const result = await DeliveryTripService.confirmTripPickup(trip.id);
    setTripBusy(false);
    if (!result.success || !result.data) {
      toast.error(result.error || "Unable to confirm pickup");
      play("error");
      return;
    }
    setTrip(result.data);
    toast.success("All orders picked up");
    play("success");
  };

  const reoptimizeTrip = async () => {
    if (!trip) return;
    setTripBusy(true);
    const result = await DeliveryTripService.reoptimize(trip.id);
    setTripBusy(false);
    if (!result.success || !result.data) {
      toast.error(result.error || "Unable to re-optimize");
      play("error");
      return;
    }
    setTrip(result.data);
    toast.success("Route re-optimized");
    play("tick");
  };

  const openTripStop = (tripStop: TripStop) => {
    setOpenStop({
      id: tripStop.id,
      type: tripStop.type,
      label: tripStop.label,
      address: tripStop.address,
      customer: tripStop.customer,
      eta: tripStop.eta || "",
      notes: tripStop.notes,
      items: tripStop.items,
      latitude: tripStop.latitude,
      longitude: tripStop.longitude,
      assignment_id: tripStop.assignment || undefined,
    });
  };

  const updateOnline = async (nextOnline: boolean) => {
    // A partner can only go online once verified. Guard here too in case the UI
    // is bypassed.
    // Hard block: a rider holding an accepted trip or mission cannot drop off the
    // grid. The order is already committed to them, so going offline would orphan
    // it until an operator noticed.
    if (!nextOnline && hasActiveWork) {
      toast.error("Finish or cancel your active trip before going offline");
      play("error");
      return;
    }
    if (nextOnline && !isVerified) {
      toast.error("Complete verification to go online");
      play("error");
      navigate("/onboarding");
      return;
    }
    // Going online is the moment trip offers start arriving, and it's a real
    // user gesture — the only context in which Android 13+ will show the
    // POST_NOTIFICATIONS prompt. Ask here rather than on first launch.
    if (nextOnline) void requestNotificationPermission();
    const previous = online;
    setOnline(nextOnline);
    const coords = await getCurrentCoords();
    if (coords) setRiderPos(coords);
    const result = await DeliveryStatusService.updateStatus(nextOnline, coords?.latitude, coords?.longitude);
    if (!result.success) {
      setOnline(previous);
      toast.error(result.error || "Unable to update status");
      play("error");
      return;
    }
    play("tick");
    if (nextOnline) refreshDashboard();
  };

  const acceptMission = async (mission: Assignment) => {
    if (mission.status !== "PENDING") {
      setActiveAssignmentId(mission.id);
      return;
    }
    const result = await DeliveryAssignmentService.acceptAssignment(mission.id);
    if (!result.success || !result.data) {
      toast.error(result.error || "Unable to accept mission");
      play("error");
      return;
    }
    setAssignments((current) => current.map((item) => item.id === mission.id ? result.data! : item));
    setActiveAssignmentId(result.data.id);
    toast.success("Mission accepted");
    play("success");
  };

  // Pickup now requires scanning the handover QR printed on the bag.
  const startPickupScan = (stop: Stop) => {
    setOpenStop(null);
    setPickupScanStop(stop);
  };

  const confirmPickup = async (stop: Stop, handoverCode: string) => {
    if (!activeMission) return;
    // The QR read itself landed — acknowledge it before the round-trip so the
    // rider can lower the phone instead of holding it on the bag.
    play("scan");
    const result = await DeliveryAssignmentService.markPickedUp(activeMission.id, handoverCode);
    if (!result.success) {
      toast.error(result.error || "Unable to confirm pickup");
      play("error");
      return;
    }
    setCompletedStopIds((current) => new Set(current).add(stop.id));
    setAssignments((current) => current.map((item) => item.id === activeMission.id ? { ...item, status: "PICKED_UP" } : item));
    toast.success("Pickup confirmed");
    play("success");
  };

  const completeStop = async (stop: Stop, proof: { type: "otp" | "photo"; otpCode?: string; photo?: File }) => {
    // Trip drop-offs carry their own assignment id; single missions use the active one.
    const isTripStop = !!stop.assignment_id;
    const assignmentId = stop.assignment_id ?? activeMission?.id;
    if (!assignmentId) return false;

    if (proof.photo) {
      const formData = new FormData();
      formData.append("mission_id", assignmentId);
      formData.append("photo", proof.photo);
      const upload = await DeliveryStatusService.uploadProof(formData);
      if (!upload.success) {
        toast.error(upload.error || "Photo upload failed");
        play("error");
        return false;
      }
    }

    if (stop.type === "pickup") {
      // Pickup is completed by scanning the handover QR, not from the drawer.
      // Return false so the drawer doesn't show the "complete" screen — the
      // scanner takes over and confirmPickup runs once the QR is read.
      startPickupScan(stop);
      return false;
    }

    // Capture the rider's location: needed for the IN_TRANSIT ping and for the
    // backend's 300m delivery geofence check.
    const coords = await getCurrentCoords();

    // Single-mission flow walks ACCEPTED → IN_TRANSIT before delivery.
    // Trip orders are already PICKED_UP via the trip-level hub pickup.
    if (!isTripStop && activeMission?.status === "ACCEPTED") {
      await DeliveryAssignmentService.markInTransit(activeMission.id, coords?.latitude, coords?.longitude);
    }

    const result = await DeliveryAssignmentService.markDelivered(
      assignmentId, stop.id, proof.type, proof.otpCode, coords?.latitude, coords?.longitude,
    );
    if (!result.success) {
      toast.error(result.error || "Unable to complete stop");
      play("error");
      return false;
    }

    const nextCompleted = new Set(completedStopIds).add(stop.id);
    setCompletedStopIds(nextCompleted);
    if (!isTripStop && activeMission) {
      setAssignments((current) => current.map((item) => item.id === activeMission.id ? { ...item, status: "IN_TRANSIT" } : item));
    }
    toast.success("Stop completed");
    play("success");
    refreshDashboard();
    return true;
  };

  const resendDeliveryOtp = async (stop: Stop) => {
    const assignmentId = stop.assignment_id ?? activeMission?.id;
    if (!assignmentId) return;
    const result = await DeliveryAssignmentService.resendOtp(assignmentId);
    if (result.success) toast.success("OTP resent to customer");
    else toast.error(result.error || "Unable to resend OTP");
  };

  const handleCancelTrip = async () => {
    if (!trip) return;
    setTripBusy(true);
    const result = await DeliveryTripService.cancelTrip(trip.id);
    setTripBusy(false);
    if (!result.success) {
      toast.error(result.error || "Unable to cancel trip");
      play("error");
      return;
    }
    setTrip(null);
    toast.success("Trip cancelled — returned to pool");
    play("tick");
    refreshDashboard();
  };

  const handleClaimFromOffer = async (tripId: string) => {
    const result = await claimTrip(tripId);
    if (result.success && result.trip) setTrip(result.trip);
    return result;
  };

  if (loading) {
    return (
      <main className="h-dvh overflow-hidden">
        <PhoneFrame>
          <div className="grid h-full place-items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </PhoneFrame>
      </main>
    );
  }

  return (
    <main className="h-dvh overflow-hidden">
      <PhoneFrame>
        <div className="flex h-full flex-col">
          <header className="px-7 pt-7">
            <Wordmark />
            {(trip || activeMission) && (
              <div className="mt-5 flex items-baseline justify-between text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
                <span className="text-foreground">{trip ? "Trip" : activeMission!.service}</span>
                <span>{trip ? trip.status : activeMission!.status}</span>
              </div>
            )}
          </header>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto overscroll-contain px-7 pb-4 pt-5"
          >
            {/* Pull-to-refresh affordance — grows with the drag, spins on release. */}
            <div
              className="flex items-end justify-center overflow-hidden"
              style={{
                height: refreshing ? PULL_THRESHOLD : pull,
                transition: pull > 0 && !refreshing ? "none" : "height .2s ease",
              }}
            >
              <Loader2
                className={`mb-2 h-5 w-5 text-primary ${refreshing ? "animate-spin" : ""}`}
                style={{
                  opacity: Math.min(1, pull / PULL_THRESHOLD),
                  transform: refreshing ? undefined : `rotate(${pull * 4}deg)`,
                }}
              />
            </div>

            <div className="space-y-4">
              {/* Hidden for the whole life of an active trip — they return as
                  soon as it completes or is cancelled. */}
              {!hasActiveWork && (
                <>
                  {isVerified ? (
                    <StatusToggle online={online} onChange={updateOnline} />
                  ) : (
                    <VerificationGate verification={verification} onOpen={() => navigate("/onboarding")} />
                  )}

                  <EarningsHeader stats={earnings} />
                </>
              )}

              {trip ? (
                // TripView draws its own map + optimized stop list.
                <TripView
                  trip={trip}
                  rider={riderPos}
                  busy={tripBusy}
                  onConfirmPickup={confirmTripPickup}
                  onTripUpdate={setTrip}
                  onReoptimize={reoptimizeTrip}
                  onOpenStop={openTripStop}
                  onCancel={handleCancelTrip}
                  onRefreshPosition={() => {
                    void getCurrentCoords().then((coords) => coords && setRiderPos(coords));
                  }}
                />
              ) : activeMission ? (
                <>
                  <RouteToggle
                    value={routeDest}
                    onChange={(next) => {
                      setRouteDest(next);
                      play("tick");
                      // Re-fix the origin on every flip — the rider has usually
                      // moved since the last GPS sample, and a route drawn from a
                      // stale point is worse than no route.
                      void getCurrentCoords().then((coords) => coords && setRiderPos(coords));
                    }}
                    hubEnabled={activeMission.stops.some((s) => s.type === "pickup" && s.latitude != null)}
                    dropoffEnabled={activeMission.stops.some((s) => s.type === "dropoff" && s.latitude != null)}
                  />
                  <DeliveryMap
                    // Drawn route follows the rider's toggle…
                    stops={toMapStops(activeMission.stops, routeDest, completedStopIds)}
                    // …but Navigate stays pinned to the stage they've reached.
                    navStops={toMapStops(activeMission.stops, missionStageDest, completedStopIds)}
                    rider={riderPos}
                    enableNavigate
                    enableLocate
                    onLocate={setRiderPos}
                    className="h-56 rounded-3xl"
                  />
                  {activeMission.status === "PENDING" ? (
                    <MissionCard mission={activeMission} onAccept={() => acceptMission(activeMission)} />
                  ) : (
                    <>
                      <RouteList
                        mission={activeMission}
                        completedStopIds={completedStopIds}
                        onOpenStop={setOpenStop}
                        onPickup={startPickupScan}
                      />
                      <FeeBreakdown mission={activeMission} />
                    </>
                  )}
                </>
              ) : online && availableTrips.length > 0 ? (
                // No map while idle — the trip pool is what matters here.
                <AvailableTripsList trips={availableTrips} busy={tripBusy} onAccept={acceptTrip} />
              ) : (
                // Offline, or online with an empty pool: just the radar, with a
                // green contact per order waiting in the pool.
                <RadarWaiting count={availableTrips.length} />
              )}

              {/* Load only means something while working — hidden when idle offline. */}
              {(online || trip || activeMission) && (
                <LoadMeter value={trip ? trip.stop_count : activeMission?.weight_kg || 0} capacity={15} />
              )}
            </div>
          </div>

          <BottomNav active="home" />
        </div>
      </PhoneFrame>

      <ProofDrawer stop={openStop} onClose={() => setOpenStop(null)} onComplete={completeStop} onResend={resendDeliveryOtp} />

      {offeredTrip && (
        <TripOffer
          trip={offeredTrip.trip}
          inRange={offeredTrip.in_range}
          onClaim={handleClaimFromOffer}
          onDismiss={dismissOffer}
        />
      )}

      {pickupScanStop && (
        <QrScanner
          title="Scan handover QR"
          hint={`Scan the bag QR for ${pickupScanStop.label}`}
          onCancel={() => setPickupScanStop(null)}
          onScan={async (code) => {
            const stop = pickupScanStop;
            setPickupScanStop(null);
            if (stop) await confirmPickup(stop, code);
          }}
        />
      )}
    </main>
  );
};

const VerificationGate = ({
  verification,
  onOpen,
}: {
  verification: { isComplete: boolean; allVerified: boolean; anyRejected: boolean; uploaded: number; required: number } | null;
  onOpen: () => void;
}) => {
  const uploaded = verification?.uploaded ?? 0;
  const required = verification?.required ?? 5;
  const anyRejected = verification?.anyRejected ?? false;
  const isComplete = verification?.isComplete ?? false;

  const { title, sub, cta } = anyRejected
    ? {
        title: "Action needed",
        sub: "A document was rejected. Re-upload it to get verified.",
        cta: "Fix documents",
      }
    : !isComplete
    ? {
        title: "Finish your sign-up",
        sub: `Upload your documents (${uploaded}/${required}) to get verified and start earning.`,
        cta: "Complete KYC",
      }
    : {
        title: "Verification in review",
        sub: "Your documents are being reviewed. You can go online once they're approved (usually within 24h).",
        cta: "View status",
      };

  return (
    <div className="relative overflow-hidden rounded-3xl glass-dark p-5 text-primary-foreground">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] opacity-80">
        <Lock className="h-3.5 w-3.5" /> Offline · Verification required
      </div>
      <div className="mt-1 text-2xl font-extrabold tracking-tight">{title}</div>
      <div className="mt-1 text-sm opacity-80">{sub}</div>

      {!anyRejected && !isComplete && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${required ? Math.round((uploaded / required) * 100) : 0}%` }}
          />
        </div>
      )}

      <button
        onClick={onOpen}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-glow-primary"
      >
        {isComplete && !anyRejected ? <ShieldCheck className="h-4 w-4" /> : null}
        {cta} <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
};

const PACKAGING_KG = 1; // 1 kg overhead per trip for packaging materials

const getTripWeightKg = (trip: DeliveryTrip): number | null => {
  const items = trip.stops.flatMap((s) => s.items || []);
  if (items.length === 0) return null;
  const hasAnyWeight = items.some((item) => item.weight_grams != null);
  if (!hasAnyWeight) return null;
  const gramsFromItems = items.reduce(
    (sum, item) => sum + (item.weight_grams ?? 0) * item.qty,
    0,
  );
  return gramsFromItems / 1000 + PACKAGING_KG;
};

const AvailableTripsList = ({
  trips,
  busy,
  onAccept,
}: {
  trips: DeliveryTrip[];
  busy?: boolean;
  onAccept: (t: DeliveryTrip) => void;
}) => {
  const [tab, setTab] = useState<"single" | "batch">("single");
  const single = trips.filter((t) => t.stops.filter((s) => s.type === "dropoff").length === 1);
  const batch = trips.filter((t) => t.stops.filter((s) => s.type === "dropoff").length > 1);
  const active = tab === "single" ? single : batch;

  return (
    <div className="space-y-3">
      <div className="flex rounded-2xl bg-muted p-1 gap-1">
        <button
          onClick={() => setTab("single")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
            tab === "single"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          Single
          {single.length > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none ${
              tab === "single" ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
            }`}>
              {single.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("batch")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
            tab === "batch"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground"
          }`}
        >
          Batch
          {batch.length > 0 && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none ${
              tab === "batch" ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
            }`}>
              {batch.length}
            </span>
          )}
        </button>
      </div>

      {active.length === 0 ? (
        <div className="rounded-2xl bg-muted/50 py-8 text-center text-sm text-muted-foreground">
          No {tab} orders available right now
        </div>
      ) : tab === "single" ? (
        <div className="grid grid-cols-2 gap-2.5">
          {single.map((t) => (
            <SingleTripCard key={t.id} trip={t} busy={busy} onAccept={() => onAccept(t)} />
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {batch.map((t) => (
            <BatchTripCard key={t.id} trip={t} busy={busy} onAccept={() => onAccept(t)} />
          ))}
        </div>
      )}
    </div>
  );
};

const SingleTripCard = ({ trip, busy, onAccept }: { trip: DeliveryTrip; busy?: boolean; onAccept: () => void }) => {
  const weightKg = getTripWeightKg(trip);
  return (
    <div className="flex flex-col rounded-2xl glass p-3.5 shadow-card-soft animate-slide-up">
      <div className="flex items-baseline gap-0.5 mb-2">
        <IndianRupee className="h-4 w-4 text-primary shrink-0 self-center" />
        <span className="text-[28px] font-black leading-none text-primary">
          {trip.earnings != null ? Number(trip.earnings).toFixed(0) : "—"}
        </span>
      </div>
      <div className="space-y-1 mb-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Route className="h-3 w-3 text-primary shrink-0" />
          {Number(trip.total_distance_km).toFixed(1)} km
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          ~{trip.total_duration_min} min
        </div>
        {weightKg != null && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Package className="h-3 w-3 shrink-0" />
            {weightKg.toFixed(2)} kg
          </div>
        )}
      </div>
      <button
        onClick={onAccept}
        disabled={busy}
        className="mt-auto flex w-full items-center justify-center gap-1 rounded-xl bg-gradient-primary py-2 text-xs font-bold text-primary-foreground shadow-glow-primary disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <>Accept <ArrowRight className="h-3.5 w-3.5" /></>}
      </button>
    </div>
  );
};

const BatchTripCard = ({ trip, busy, onAccept }: { trip: DeliveryTrip; busy?: boolean; onAccept: () => void }) => {
  const dropoffs = trip.stops.filter((s) => s.type === "dropoff");
  const weightKg = getTripWeightKg(trip);
  return (
    <div className="rounded-3xl glass p-4 shadow-card-soft animate-slide-up">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-amber px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground shadow-glow-amber">
            <Package className="h-3 w-3" /> {dropoffs.length} stops
          </span>
          <div className="mt-1.5 text-xs text-muted-foreground">{trip.hub?.label || "Hub"}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-baseline gap-0.5 justify-end">
            <IndianRupee className="h-4 w-4 text-primary self-center" />
            <span className="text-3xl font-black leading-none text-primary">
              {trip.earnings != null ? Number(trip.earnings).toFixed(0) : "—"}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">estimated</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex items-center gap-1 text-xs font-bold text-foreground">
          <Route className="h-3.5 w-3.5 text-primary" />
          {Number(trip.total_distance_km).toFixed(1)} km
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          ~{trip.total_duration_min} min
        </div>
        {weightKg != null && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Package className="h-3.5 w-3.5" />
            {weightKg.toFixed(2)} kg
          </div>
        )}
      </div>
      <button
        onClick={onAccept}
        disabled={busy}
        className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-glow-primary disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Accept batch <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
};

/**
 * Project a mission's stops onto one leg for the map. Passing a single leg means
 * the map draws one rider → destination route rather than chaining hub and drops
 * into a single line.
 */
const toMapStops = (stops: Stop[], leg: RouteDest, completed: Set<string>) =>
  stops
    .filter((s) => (leg === "hub" ? s.type === "pickup" : s.type === "dropoff"))
    .map((s) => ({
      latitude: s.latitude ?? null,
      longitude: s.longitude ?? null,
      type: s.type,
      label: s.label,
      sequence: s.sequence ?? 0,
      is_completed: completed.has(s.id),
    }));

const getCurrentCoords = () => new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
  if (!navigator.geolocation) {
    resolve(null);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => resolve({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    }),
    () => resolve(null),
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
  );
});

export default Index;
