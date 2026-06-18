import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, ChevronLeft, Clock, Home, IndianRupee, Loader2, Lock, LogOut, Map, Package, Receipt, RefreshCw, Route, ShieldCheck, User, Wifi, WifiOff } from "lucide-react";
import { PhoneFrame } from "@/components/freshon/PhoneFrame";
import { FreshOnLogo } from "@/components/freshon/Logo";
import { StatusToggle } from "@/components/freshon/StatusToggle";
import { EarningsHeader } from "@/components/freshon/EarningsHeader";
import { MissionCard } from "@/components/freshon/MissionCard";
import { RadarWaiting } from "@/components/freshon/RadarWaiting";
import { LoadMeter } from "@/components/freshon/LoadMeter";
import { AlertHub } from "@/components/freshon/AlertHub";
import { DeliveryMap } from "@/components/freshon/DeliveryMap";
import { TripView } from "@/components/freshon/TripView";
import { RouteList } from "@/components/freshon/RouteList";
import { FeeBreakdown } from "@/components/freshon/FeeBreakdown";
import { ProofDrawer } from "@/components/freshon/ProofDrawer";
import { QrScanner } from "@/components/freshon/QrScanner";
import { Assignment, EarningsStats, Stop } from "@/lib/types";
import { DeliveryAssignmentService } from "@/lib/deliveryAssignmentService";
import { DeliveryStatusService } from "@/lib/deliveryStatusService";
import { DeliveryPartnerService } from "@/lib/deliveryPartnerService";
import { DeliveryTrip, DeliveryTripService, TripStop } from "@/lib/deliveryTripService";
import { useAuth } from "@/hooks/useAuth";
import { useDeliverySocket } from "@/hooks/useDeliverySocket";
import { TripOffer } from "@/components/freshon/TripOffer";

type Screen = "dashboard" | "mission";

const emptyStats: EarningsStats = {
  earnings: 0,
  goal: 1500,
  deliveries: 0,
  distance: 0,
  rating: 5,
};

const Index = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  // Read the JWT that apiClient keeps in localStorage — reuse it for WS auth.
  const wsToken = typeof localStorage !== "undefined"
    ? localStorage.getItem("freshon_delivery_access")
    : null;
  const { wsOnline, offeredTrip, claimTrip, dismissOffer } = useDeliverySocket(wsToken);

  const [screen, setScreen] = useState<Screen>("dashboard");
  const [online, setOnline] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [completedStopIds, setCompletedStopIds] = useState<Set<string>>(new Set());
  const [earnings, setEarnings] = useState<EarningsStats>(emptyStats);
  const [openStop, setOpenStop] = useState<Stop | null>(null);
  const [pickupScanStop, setPickupScanStop] = useState<Stop | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const activeMission = useMemo(() => {
    return assignments.find((assignment) => assignment.id === activeAssignmentId)
      || assignments.find((assignment) => assignment.status !== "PENDING")
      || assignments[0]
      || null;
  }, [activeAssignmentId, assignments]);

  useEffect(() => {
    refreshDashboard();
  }, []);

  const refreshDashboard = async () => {
    setRefreshing(true);
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
    setRefreshing(false);
  };

  const acceptTrip = async (tripToAccept: DeliveryTrip) => {
    setTripBusy(true);
    const result = await DeliveryTripService.acceptTrip(tripToAccept.id);
    setTripBusy(false);
    if (!result.success || !result.data) {
      toast.error(result.error || "Unable to accept trip");
      return;
    }
    setTrip(result.data);
    setAvailableTrips((current) => current.filter((t) => t.id !== tripToAccept.id));
    setScreen("mission");
    toast.success("Trip accepted");
  };

  const confirmTripPickup = async () => {
    if (!trip) return;
    setTripBusy(true);
    const result = await DeliveryTripService.confirmTripPickup(trip.id);
    setTripBusy(false);
    if (!result.success || !result.data) {
      toast.error(result.error || "Unable to confirm pickup");
      return;
    }
    setTrip(result.data);
    toast.success("All orders picked up");
  };

  const reoptimizeTrip = async () => {
    if (!trip) return;
    setTripBusy(true);
    const result = await DeliveryTripService.reoptimize(trip.id);
    setTripBusy(false);
    if (!result.success || !result.data) {
      toast.error(result.error || "Unable to re-optimize");
      return;
    }
    setTrip(result.data);
    toast.success("Route re-optimized");
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
    if (nextOnline && !isVerified) {
      toast.error("Complete verification to go online");
      navigate("/onboarding");
      return;
    }
    const previous = online;
    setOnline(nextOnline);
    const coords = await getCurrentCoords();
    if (coords) setRiderPos(coords);
    const result = await DeliveryStatusService.updateStatus(nextOnline, coords?.latitude, coords?.longitude);
    if (!result.success) {
      setOnline(previous);
      toast.error(result.error || "Unable to update status");
      return;
    }
    if (nextOnline) refreshDashboard();
  };

  const acceptMission = async (mission: Assignment) => {
    if (mission.status !== "PENDING") {
      setActiveAssignmentId(mission.id);
      setScreen("mission");
      return;
    }
    const result = await DeliveryAssignmentService.acceptAssignment(mission.id);
    if (!result.success || !result.data) {
      toast.error(result.error || "Unable to accept mission");
      return;
    }
    setAssignments((current) => current.map((item) => item.id === mission.id ? result.data! : item));
    setActiveAssignmentId(result.data.id);
    setScreen("mission");
    toast.success("Mission accepted");
  };

  // Pickup now requires scanning the handover QR printed on the bag.
  const startPickupScan = (stop: Stop) => {
    setOpenStop(null);
    setPickupScanStop(stop);
  };

  const confirmPickup = async (stop: Stop, handoverCode: string) => {
    if (!activeMission) return;
    const result = await DeliveryAssignmentService.markPickedUp(activeMission.id, handoverCode);
    if (!result.success) {
      toast.error(result.error || "Unable to confirm pickup");
      return;
    }
    setCompletedStopIds((current) => new Set(current).add(stop.id));
    setAssignments((current) => current.map((item) => item.id === activeMission.id ? { ...item, status: "PICKED_UP" } : item));
    toast.success("Pickup confirmed");
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
      return false;
    }

    const nextCompleted = new Set(completedStopIds).add(stop.id);
    setCompletedStopIds(nextCompleted);
    if (!isTripStop && activeMission) {
      setAssignments((current) => current.map((item) => item.id === activeMission.id ? { ...item, status: "IN_TRANSIT" } : item));
    }
    toast.success("Stop completed");
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
      return;
    }
    setTrip(null);
    setScreen("dashboard");
    toast.success("Trip cancelled — returned to pool");
    refreshDashboard();
  };

  const handleClaimFromOffer = async (tripId: string) => {
    const result = await claimTrip(tripId);
    if (result.success && result.trip) {
      setTrip(result.trip);
      setScreen("mission");
    }
    return result;
  };

  const logout = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  if (loading) {
    return (
      <main className="grid h-dvh place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="h-dvh overflow-hidden">
      <PhoneFrame>
        {screen === "dashboard" && (
          <div className="flex h-full flex-col">
            <header className="flex items-center justify-between px-5 pt-6">
              <FreshOnLogo />
              <div className="flex items-center gap-2">
                {wsOnline
                  ? <Wifi className="h-4 w-4 text-green-500" title="Dispatch connected" />
                  : <WifiOff className="h-4 w-4 text-muted-foreground/40" title="Dispatch offline" />
                }
                <button
                  onClick={refreshDashboard}
                  className="grid h-10 w-10 place-items-center rounded-2xl bg-card ring-1 ring-border"
                  aria-label="Refresh assignments"
                >
                  <RefreshCw className={`h-4 w-4 text-foreground ${refreshing ? "animate-spin" : ""}`} />
                </button>
                <button
                  onClick={() => navigate("/onboarding")}
                  className="grid h-10 w-10 place-items-center rounded-2xl bg-card ring-1 ring-border"
                  aria-label="Profile and KYC"
                >
                  <User className="h-4 w-4 text-foreground" />
                </button>
                <button
                  onClick={logout}
                  className="grid h-10 w-10 place-items-center rounded-2xl bg-card ring-1 ring-border"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4 text-foreground" />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4 space-y-4">
              {isVerified ? (
                <StatusToggle online={online} onChange={updateOnline} />
              ) : (
                <VerificationGate verification={verification} onOpen={() => navigate("/onboarding")} />
              )}
              <EarningsHeader stats={earnings} />
              {trip ? (
                <ActiveTripCard trip={trip} onOpen={() => setScreen("mission")} />
              ) : online && availableTrips.length > 0 ? (
                <AvailableTripsList
                  trips={availableTrips}
                  busy={tripBusy}
                  onAccept={acceptTrip}
                />
              ) : online && activeMission ? (
                <MissionCard mission={activeMission} onAccept={() => acceptMission(activeMission)} />
              ) : (
                <RadarWaiting />
              )}
              <LoadMeter value={trip ? trip.stop_count : activeMission?.weight_kg || 0} capacity={15} />
              <div>
                <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Notification Hub</div>
                <AlertHub assignmentCount={assignments.length} />
              </div>
            </div>

            <BottomNav active="home" onMission={() => activeMission && setScreen("mission")} />
          </div>
        )}

        {screen === "mission" && (trip || activeMission) && (
          <div className="flex h-full flex-col">
            <header className="flex items-center justify-between px-5 pt-6">
              <button
                onClick={() => setScreen("dashboard")}
                className="flex items-center gap-1 rounded-2xl bg-card px-3 py-2 text-sm font-semibold text-foreground ring-1 ring-border"
              >
                <ChevronLeft className="h-4 w-4" /> Dashboard
              </button>
              <span className="rounded-full bg-gradient-amber px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent-foreground shadow-glow-amber animate-amber-pulse">
                {trip ? `TRIP · ${trip.status}` : `${activeMission!.service} · ${activeMission!.status}`}
              </span>
            </header>

            {trip ? (
              <div className="flex-1 overflow-y-auto pt-4 pb-8">
                <TripView
                  trip={trip}
                  rider={riderPos}
                  busy={tripBusy}
                  onConfirmPickup={confirmTripPickup}
                  onTripUpdate={setTrip}
                  onReoptimize={reoptimizeTrip}
                  onOpenStop={openTripStop}
                  onCancel={handleCancelTrip}
                />
              </div>
            ) : activeMission ? (
              <div className="flex-1 overflow-y-auto space-y-4 px-5 pt-4 pb-4">
                <DeliveryMap
                  stops={activeMission.stops
                    // Stage the route: before pickup show rider → hub; once picked
                    // up, show the route to the customer drop-off(s).
                    .filter((s) =>
                      activeMission.status === "PICKED_UP" || activeMission.status === "IN_TRANSIT"
                        ? s.type === "dropoff"
                        : s.type === "pickup",
                    )
                    .map((s) => ({
                      latitude: s.latitude ?? null,
                      longitude: s.longitude ?? null,
                      type: s.type,
                      label: s.label,
                      sequence: s.sequence ?? 0,
                      is_completed: completedStopIds.has(s.id),
                    }))}
                  rider={riderPos}
                  enableNavigate
                  enableLocate
                  onLocate={setRiderPos}
                />
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Mission Stops</div>
                    <div className="text-lg font-extrabold text-foreground">Optimized sequence · {activeMission.stops.length} stops</div>
                  </div>
                  <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                    Live
                  </span>
                </div>
                <RouteList
                  mission={activeMission}
                  completedStopIds={completedStopIds}
                  onOpenStop={setOpenStop}
                  onPickup={startPickupScan}
                />
                <FeeBreakdown mission={activeMission} />
              </div>
            ) : null}

            <BottomNav active="map" onMission={() => setScreen("mission")} />
          </div>
        )}
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

const ActiveTripCard = ({ trip, onOpen }: { trip: DeliveryTrip; onOpen: () => void }) => {
  const dropoffs = trip.stops.filter((s) => s.type === "dropoff");
  const done = dropoffs.filter((s) => s.is_completed).length;
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-slate p-5 text-primary-foreground shadow-elevated animate-slide-up">
      <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/20 blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            <Route className="h-3.5 w-3.5" /> Active trip
          </span>
          <span className="text-xs opacity-70">{trip.status}</span>
        </div>
        <div className="mt-3 text-2xl font-extrabold leading-tight">{dropoffs.length} stops · {Number(trip.total_distance_km).toFixed(1)} km</div>
        <div className="mt-1 text-sm opacity-80">~{trip.total_duration_min} min · {done}/{dropoffs.length} delivered</div>
        {trip.earnings != null && (
          <div className="mt-1 flex items-center gap-1 text-sm font-bold text-accent">
            <IndianRupee className="h-3.5 w-3.5" />
            {Number(trip.earnings).toFixed(2)} this trip
          </div>
        )}
        <button
          onClick={onOpen}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-5 py-4 text-sm font-bold text-primary-foreground shadow-glow-primary"
        >
          Open route <ArrowRight className="h-4 w-4" />
        </button>
      </div>
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

const BottomNav = ({ active, onMission }: { active: "home" | "map"; onMission: () => void }) => {
  const navigate = useNavigate();
  return (
    <nav className="shrink-0 px-4 pb-4 pt-1">
      <div className="glass mx-auto flex items-center justify-around rounded-3xl px-3 py-2 shadow-elevated">
        <NavBtn icon={Home} label="Home" active={active === "home"} />
        <button
          onClick={onMission}
          className="-mt-7 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow-primary"
          aria-label="Mission"
        >
          <Map className="h-5 w-5" />
        </button>
        <NavBtn icon={Receipt} label="Earnings" onClick={() => navigate("/earnings")} />
        <NavBtn icon={User} label="Profile" onClick={() => navigate("/profile")} />
      </div>
    </nav>
  );
};

const NavBtn = ({ icon: Icon, label, active, onClick }: { icon: any; label: string; active?: boolean; onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition
    ${active ? "text-primary" : "text-muted-foreground"}`}>
    <Icon className="h-4 w-4" />
    {label}
  </button>
);

export default Index;
