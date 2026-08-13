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
import { ProofDrawer, type ProofOutcome, type ProofSubmission } from "@/components/freshon/ProofDrawer";
import { QrScanner } from "@/components/freshon/QrScanner";
import { RouteToggle, RouteDest } from "@/components/freshon/RouteToggle";
import { play } from "@/lib/sound";
import { ensureLocationPermission, requestNotificationPermission } from "@/lib/permissions";
import { startBackgroundTracking, stopBackgroundTracking } from "@/lib/bgLocation";
import { Assignment, EarningsStats, Stop } from "@/lib/types";
import { DeliveryAssignmentService } from "@/lib/deliveryAssignmentService";
import { DeliveryStatusService } from "@/lib/deliveryStatusService";
import { DeliveryPartnerService } from "@/lib/deliveryPartnerService";
import { DeliveryTrip, DeliveryTripService, TripStop } from "@/lib/deliveryTripService";
import type { ScannedBag } from "@/lib/bagCode";
import { useDeliverySocket } from "@/hooks/useDeliverySocket";
import { TripOffer } from "@/components/freshon/TripOffer";
import { TripPreview } from "@/components/freshon/TripPreview";
import { TripDistance, tripWeightKg, useTripDistance } from "@/lib/tripDistance";
import { getCurrentCoords, useWatchRiderPosition, type RiderPosition } from "@/lib/riderPosition";
import { classifyDeliveryError, type DeliveryFailure } from "@/lib/deliveryErrors";
import { useStopProximity } from "@/lib/stopProximity";

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
  // Covers the whole go-online sequence: permissions, GPS fix, status write, fetch.
  const [statusPending, setStatusPending] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [completedStopIds, setCompletedStopIds] = useState<Set<string>>(new Set());
  const [earnings, setEarnings] = useState<EarningsStats>(emptyStats);
  const [openStop, setOpenStop] = useState<Stop | null>(null);
  const [pickupScanStop, setPickupScanStop] = useState<Stop | null>(null);
  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState<DeliveryTrip | null>(null);
  const [availableTrips, setAvailableTrips] = useState<DeliveryTrip[]>([]);
  const [previewTrip, setPreviewTrip] = useState<DeliveryTrip | null>(null);
  const [riderPos, setRiderPos] = useState<RiderPosition | null>(null);
  const [tripBusy, setTripBusy] = useState(false);

  // Quoted distance covers the ride to the hub as well as the drops themselves.
  const distanceOf = useTripDistance(availableTrips, riderPos);
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

  // While work is running the rider's position drives the proof-of-delivery
  // gate, so it has to follow them rather than sit on the fix taken when the
  // trip was accepted. Watching stops the moment the work does.
  useWatchRiderPosition(hasActiveWork, setRiderPos);

  // Hand live-location duty to the native Android foreground service while a
  // delivery is running. The JS WebSocket heartbeat (deliverySocket.ts) freezes
  // the moment the app is backgrounded; the service keeps reporting position for
  // the whole trip and shows the persistent notification Android requires. It's
  // handed the freshest access token; stopping happens on completion/cancel or
  // when this screen unmounts. No-op on web/desktop.
  useEffect(() => {
    if (!hasActiveWork) return;
    const token = localStorage.getItem("freshon_delivery_access");
    const baseUrl = import.meta.env.VITE_API_URL as string | undefined;
    if (token && baseUrl) {
      void startBackgroundTracking({
        baseUrl,
        token,
        intervalMs: 30_000,
        notificationTitle: "Delivery in progress",
        notificationBody: "FreshOn is sharing your location for this trip",
      });
    }
    return () => {
      void stopBackgroundTracking();
    };
  }, [hasActiveWork]);

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
    setPreviewTrip(null);
    toast.success("Trip accepted");
    play("success");
  };

  const confirmTripPickup = async (bags: ScannedBag[]) => {
    if (!trip) return;
    setTripBusy(true);
    const result = await DeliveryTripService.confirmTripPickup(trip.id, bags);
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
      customer_phone: tripStop.customer_phone,
      eta: tripStop.eta || "",
      notes: tripStop.notes,
      latitude: tripStop.latitude,
      longitude: tripStop.longitude,
      assignment_id: tripStop.assignment || undefined,
      order_id: tripStop.order_id,
      weight_kg: tripStop.weight_kg,
      parcel_count: tripStop.parcel_count,
    });
  };

  /**
   * The drop-offs still to be proved, whichever flow they came from. Each target
   * carries its own `open` because a trip stop has to be projected onto a `Stop`
   * first while a mission stop already is one — the proximity gate shouldn't
   * have to know the difference.
   */
  const proofTargets = useMemo(() => {
    if (trip) {
      if (trip.status !== "ACTIVE") return [];
      return trip.stops
        .filter((s) => s.type === "dropoff" && !s.is_completed)
        .map((s) => ({
          id: s.id,
          latitude: s.latitude,
          longitude: s.longitude,
          open: () => openTripStop(s),
        }));
    }
    if (activeMission && activeMission.status !== "PENDING") {
      return activeMission.stops
        .filter((s) => s.type === "dropoff" && !completedStopIds.has(s.id))
        .map((s) => ({
          id: s.id,
          latitude: s.latitude,
          longitude: s.longitude,
          open: () => setOpenStop(s),
        }));
    }
    return [];
  }, [trip, activeMission, completedStopIds]);

  const { of: proximityOf, inRange } = useStopProximity(proofTargets, riderPos);

  /**
   * Arrival opens the sheet for the rider. On a batch that is the *nearest*
   * in-range drop — several stops of one batch often sit in the same lane, and
   * picking the right row while holding bags is exactly the friction this
   * removes. Single orders are the same rule with a list of one.
   *
   * Each stop is offered once: a rider who closes the sheet to call the customer
   * first must not have to fight it reopening. Walking out of range re-arms it,
   * so coming back around opens it again.
   */
  const autoOpened = useRef(new Set<string>());
  const inRangeKey = inRange.map((entry) => entry.target.id).join("|");
  useEffect(() => {
    const ids = new Set(inRange.map((entry) => entry.target.id));
    autoOpened.current.forEach((id) => {
      if (!ids.has(id)) autoOpened.current.delete(id);
    });

    const nearest = inRange[0];
    if (!nearest || autoOpened.current.has(nearest.target.id)) return;
    // Never yank the screen out from under a sheet, scanner or offer already up.
    if (openStop || pickupScanStop || previewTrip || offeredTrip) return;

    autoOpened.current.add(nearest.target.id);
    nearest.target.open();
    play("tick");
    // `inRangeKey` stands in for `inRange`, which is a fresh array per GPS sample.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inRangeKey, openStop, pickupScanStop, previewTrip, offeredTrip]);

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
    // user gesture — the only context in which Android will show the
    // POST_NOTIFICATIONS and location prompts. Ask for both here, and hard-block
    // going online if either is refused: without location the rider can't be
    // routed or tracked, and without notifications they'd silently miss offers.
    // Everything from here can take seconds — two permission prompts, a GPS fix
    // with an 8s ceiling, the status write, then the dashboard fetch. The toggle
    // showed none of it, so the rider's tap looked ignored. Held until the data
    // is actually on screen, not just until the request returns.
    setStatusPending(true);
    try {
    if (nextOnline) {
      const [notifyOk, locationOk] = await Promise.all([
        requestNotificationPermission(),
        ensureLocationPermission(),
      ]);
      if (!locationOk || !notifyOk) {
        const missing = [
          !locationOk && "Location",
          !notifyOk && "Notifications",
        ].filter(Boolean) as string[];
        // The request calls above re-prompt on a first denial, but once Android
        // marks a permission permanently denied it stops showing the dialog —
        // re-requesting then returns "denied" with no prompt. Point the rider to
        // Settings so a blocked grant is always recoverable.
        toast.error(`${missing.join(" & ")} permission required to go online`, {
          description:
            "Tap Allow when prompted. If nothing appears, enable it in " +
            "Settings ▸ Apps ▸ Freshon Delivery ▸ Permissions, then try again.",
        });
        play("error");
        return;
      }
    }
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
    // Awaited, unlike before: the fetch is the slowest part and the one the
    // rider is actually waiting on, so the toggle stays busy until the missions
    // are on screen rather than going idle over an empty list.
    if (nextOnline) await refreshDashboard();
    } finally {
      setStatusPending(false);
    }
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

  /**
   * Proof photos already stored, keyed by stop.
   *
   * The upload has to happen before `deliver/`, and `deliver/` is the call that
   * rejects a wrong OTP — so without this, every re-entered code uploaded the
   * same photo again and left the failed ones orphaned in storage with no row
   * pointing at them. The `File` identity is part of the key, so a retake is
   * correctly treated as a different photo and does get re-uploaded.
   */
  const uploadedProof = useRef(new Map<string, { file: File; url: string | null }>());

  /** Reports the failure to the rider and hands the drawer enough to react. */
  const stopFailed = (error: string, failure: DeliveryFailure): ProofOutcome => {
    toast.error(error);
    play("error");
    return { ok: false, error, failure };
  };

  const completeStop = async (stop: Stop, proof: ProofSubmission): Promise<ProofOutcome> => {
    // Trip drop-offs carry their own assignment id; single missions use the active one.
    const isTripStop = !!stop.assignment_id;
    const assignmentId = stop.assignment_id ?? activeMission?.id;
    if (!assignmentId) {
      return stopFailed("This stop isn't linked to an assignment yet. Refresh and try again.", "state");
    }

    if (stop.type === "pickup") {
      // Pickup is completed by scanning the handover QR, not from the drawer.
      // Return false so the drawer doesn't show the "complete" screen — the
      // scanner takes over and confirmPickup runs once the QR is read.
      startPickupScan(stop);
      return false;
    }

    /**
     * The rider's location, for the IN_TRANSIT ping and the backend's 300 m
     * delivery geofence. `getCurrentCoords` is a one-shot that gives up after
     * five seconds; the live watch behind `riderPos` is usually warmer, so it
     * stands in rather than sending the delivery up with no position at all.
     */
    const coords = (await getCurrentCoords()) ?? riderPos;

    // A stop the backend sent without coordinates cannot be geofenced at either
    // end, so it completes without a fix. One that can be is refused here
    // rather than by an opaque server rejection after the upload.
    const geofenced = stop.latitude != null && stop.longitude != null;
    if (!coords && geofenced) {
      return stopFailed(
        "Can't confirm your location. Turn location on and try again — the delivery needs it.",
        "location",
      );
    }

    // Ordering: location is checked before the upload so a rider who is going
    // to be refused hasn't already spent the data on a photo.
    let proofUrl: string | null = null;
    if (proof.photo) {
      const cached = uploadedProof.current.get(stop.id);
      if (cached && cached.file === proof.photo) {
        proofUrl = cached.url;
      } else {
        const upload = await DeliveryStatusService.uploadProof({
          missionId: assignmentId,
          stopId: stop.id,
          photo: proof.photo,
          capturedAt: proof.photoMeta?.capturedAt,
          latitude: proof.photoMeta?.latitude,
          longitude: proof.photoMeta?.longitude,
          accuracyM: proof.photoMeta?.accuracy,
        });
        if (!upload.success) {
          const error = upload.error || "Photo upload failed";
          return stopFailed(error, classifyDeliveryError(error));
        }
        proofUrl = upload.data?.url ?? null;
        uploadedProof.current.set(stop.id, { file: proof.photo, url: proofUrl });
      }
    }

    // Single-mission flow walks ACCEPTED → IN_TRANSIT before delivery.
    // Trip orders are already PICKED_UP via the trip-level hub pickup.
    if (!isTripStop && activeMission?.status === "ACCEPTED") {
      const transit = await DeliveryAssignmentService.markInTransit(
        activeMission.id, coords?.latitude, coords?.longitude,
      );
      // Ignoring this used to let the delivery go out against a mission the
      // backend still had as ACCEPTED, and the rider got the state error from
      // `deliver/` instead of the real one from here.
      if (!transit.success) {
        const error = transit.error || "Couldn't start this delivery. Try again.";
        return stopFailed(error, classifyDeliveryError(error));
      }
    }

    const result = await DeliveryAssignmentService.markDelivered(assignmentId, {
      stopId: stop.id,
      type: proof.type,
      otpCode: proof.otpCode,
      latitude: coords?.latitude,
      longitude: coords?.longitude,
      accuracyM: coords?.accuracy,
      photoCaptured: !!proof.photo,
      proofUrl,
      exceptionReason: proof.exceptionReason,
    });
    if (!result.success) {
      const error = result.error || "Unable to complete stop";
      return stopFailed(error, classifyDeliveryError(error));
    }

    // Delivered — the cached upload has done its job and the stop will not be
    // submitted again.
    uploadedProof.current.delete(stop.id);

    const nextCompleted = new Set(completedStopIds).add(stop.id);
    setCompletedStopIds(nextCompleted);
    if (!isTripStop && activeMission) {
      setAssignments((current) => current.map((item) => item.id === activeMission.id ? { ...item, status: "IN_TRANSIT" } : item));
    }
    toast.success(
      proof.exceptionReason ? "Stop completed — flagged for review" : "Stop completed",
    );
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
          <header className="px-5 pt-7">
            <Wordmark />
            {(trip || activeMission) && (
              <div className="mt-5 flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-foreground">
                  {trip ? "Trip" : activeMission!.service}
                </span>
                <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                  {(trip ? trip.status : activeMission!.status).replace(/_/g, " ")}
                </span>
              </div>
            )}
          </header>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-5"
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
                    <StatusToggle online={online} pending={statusPending} onChange={updateOnline} />
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
                  onReoptimize={reoptimizeTrip}
                  onOpenStop={openTripStop}
                  proximityOf={proximityOf}
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
                        proximityOf={proximityOf}
                      />
                      <FeeBreakdown mission={activeMission} />
                    </>
                  )}
                </>
              ) : online && availableTrips.length > 0 ? (
                // No map while idle — the trip pool is what matters here.
                <AvailableTripsList
                  trips={availableTrips}
                  busy={tripBusy}
                  onPreview={setPreviewTrip}
                  distanceOf={distanceOf}
                />
              ) : (
                // Offline, or online with an empty pool: just the radar, with a
                // green contact per order waiting in the pool.
                <RadarWaiting count={availableTrips.length} />
              )}

              {/* Load only means something while working — hidden when idle offline. */}
              {(online || trip || activeMission) && (
                <LoadMeter
                  // Was passing trip.stop_count into a meter labelled kg — a
                  // 3-stop trip read as "3 / 15 kg".
                  value={trip ? tripWeightKg(trip) : activeMission?.weight_kg ?? null}
                  capacity={20}
                />
              )}
            </div>
          </div>

          <BottomNav active="home" />
        </div>
      </PhoneFrame>

      <ProofDrawer
        stop={openStop}
        onClose={() => setOpenStop(null)}
        onComplete={completeStop}
        onResend={resendDeliveryOtp}
        proximity={openStop ? proximityOf(openStop.id) : null}
        onRefreshPosition={async () => {
          const coords = await getCurrentCoords();
          if (coords) setRiderPos(coords);
        }}
      />

      {previewTrip && (
        <TripPreview
          trip={previewTrip}
          distance={distanceOf(previewTrip)}
          busy={tripBusy}
          onAccept={acceptTrip}
          onClose={() => setPreviewTrip(null)}
        />
      )}

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

const AvailableTripsList = ({
  trips,
  busy,
  onPreview,
  distanceOf,
}: {
  trips: DeliveryTrip[];
  busy?: boolean;
  onPreview: (t: DeliveryTrip) => void;
  distanceOf: (t: DeliveryTrip) => TripDistance;
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
            <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-black leading-none ${
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
            <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-black leading-none ${
              tab === "batch" ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
            }`}>
              {batch.length}
            </span>
          )}
        </button>
      </div>

      {active.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-muted/50 px-6 py-10 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-card text-muted-foreground ring-1 ring-border">
            <Package className="h-5 w-5" />
          </div>
          <div className="text-sm text-muted-foreground">No {tab} orders available right now</div>
        </div>
      ) : tab === "single" ? (
        <div className="grid grid-cols-2 gap-2.5">
          {single.map((t) => (
            <SingleTripCard key={t.id} trip={t} distance={distanceOf(t)} busy={busy} onPreview={() => onPreview(t)} />
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {batch.map((t) => (
            <BatchTripCard key={t.id} trip={t} distance={distanceOf(t)} busy={busy} onPreview={() => onPreview(t)} />
          ))}
        </div>
      )}
    </div>
  );
};

/** Weight is always shown — a blank row where the load should be reads as
 *  "nothing to carry" rather than "not reported". */
const WeightRow = ({ weightKg, className = "" }: { weightKg: number | null; className?: string }) => (
  <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}>
    <Package className="h-3 w-3 shrink-0" />
    {weightKg != null ? `${weightKg.toFixed(2)} kg` : "Weight n/a"}
  </div>
);

const SingleTripCard = ({
  trip,
  distance,
  busy,
  onPreview,
}: {
  trip: DeliveryTrip;
  distance: TripDistance;
  busy?: boolean;
  onPreview: () => void;
}) => (
  <button
    onClick={onPreview}
    disabled={busy}
    className="flex flex-col rounded-3xl glass p-4 text-left shadow-card-soft animate-slide-up transition-all hover:ring-1 hover:ring-primary/40 active:scale-[0.99] disabled:opacity-60"
  >
    <div className="flex items-baseline gap-0.5 mb-2.5">
      <IndianRupee className="h-4 w-4 text-primary shrink-0 self-center" />
      <span className="text-[28px] font-black leading-none tabular-nums text-primary">
        {trip.earnings != null ? Number(trip.earnings).toFixed(0) : "—"}
      </span>
    </div>
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Route className="h-3 w-3 text-primary shrink-0" />
        {distance.totalKm.toFixed(1)} km
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3 w-3 shrink-0" />
        ~{trip.total_duration_min} min
      </div>
      <WeightRow weightKg={tripWeightKg(trip)} />
    </div>
    <span className="mt-3.5 flex items-center justify-center gap-1 rounded-2xl bg-primary-soft py-2.5 text-xs font-bold text-primary">
      View details <ArrowRight className="h-3.5 w-3.5" />
    </span>
  </button>
);

const BatchTripCard = ({
  trip,
  distance,
  busy,
  onPreview,
}: {
  trip: DeliveryTrip;
  distance: TripDistance;
  busy?: boolean;
  onPreview: () => void;
}) => {
  const dropoffs = trip.stops.filter((s) => s.type === "dropoff");
  const weightKg = tripWeightKg(trip);
  return (
    <button
      onClick={onPreview}
      disabled={busy}
      className="w-full rounded-3xl glass p-4 text-left shadow-card-soft animate-slide-up transition-all hover:ring-1 hover:ring-primary/40 active:scale-[0.99] disabled:opacity-60"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-amber px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent-foreground shadow-glow-amber">
            <Package className="h-3 w-3" /> {dropoffs.length} stops
          </span>
          <div className="mt-1.5 text-xs text-muted-foreground">{trip.hub?.label || "Hub"}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-baseline gap-0.5 justify-end">
            <IndianRupee className="h-4 w-4 text-primary self-center" />
            <span className="text-3xl font-black leading-none tabular-nums text-primary">
              {trip.earnings != null ? Number(trip.earnings).toFixed(0) : "—"}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">estimated</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex items-center gap-1 text-xs font-bold text-foreground">
          <Route className="h-3.5 w-3.5 text-primary" />
          {distance.totalKm.toFixed(1)} km
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          ~{trip.total_duration_min} min
        </div>
        <WeightRow weightKg={weightKg} />
      </div>
      {distance.approachKm != null && (
        <div className="mt-1 text-[11px] text-muted-foreground">
          {distance.approachKm.toFixed(1)} km to hub + {distance.routeKm.toFixed(1)} km of drops
        </div>
      )}
      <span className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-soft px-5 py-3 text-sm font-bold text-primary">
        View details <ArrowRight className="h-4 w-4" />
      </span>
    </button>
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

export default Index;
