import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, ChevronLeft, Home, Loader2, LogOut, Map, Package, Receipt, RefreshCw, Route, User } from "lucide-react";
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
import { Assignment, EarningsStats, Stop } from "@/lib/types";
import { DeliveryAssignmentService } from "@/lib/deliveryAssignmentService";
import { DeliveryStatusService } from "@/lib/deliveryStatusService";
import { DeliveryTrip, DeliveryTripService, TripStop } from "@/lib/deliveryTripService";
import { useAuth } from "@/hooks/useAuth";

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
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [online, setOnline] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [completedStopIds, setCompletedStopIds] = useState<Set<string>>(new Set());
  const [earnings, setEarnings] = useState<EarningsStats>(emptyStats);
  const [openStop, setOpenStop] = useState<Stop | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trip, setTrip] = useState<DeliveryTrip | null>(null);
  const [availableTrips, setAvailableTrips] = useState<DeliveryTrip[]>([]);
  const [riderPos, setRiderPos] = useState<{ latitude: number; longitude: number } | null>(null);
  const [tripBusy, setTripBusy] = useState(false);

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
    const [assignmentResult, earningsResult, tripResult, availableResult] = await Promise.all([
      DeliveryAssignmentService.getAssignments(),
      DeliveryStatusService.getEarnings(),
      DeliveryTripService.getActiveTrip(),
      DeliveryTripService.getAvailableTrips(),
    ]);

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

  const confirmPickup = async (stop: Stop) => {
    if (!activeMission) return;
    const result = await DeliveryAssignmentService.markPickedUp(activeMission.id);
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
      await confirmPickup(stop);
      return true;
    }

    // Single-mission flow walks ACCEPTED → IN_TRANSIT before delivery.
    // Trip orders are already PICKED_UP via the trip-level hub pickup.
    if (!isTripStop && activeMission?.status === "ACCEPTED") {
      const coords = await getCurrentCoords();
      await DeliveryAssignmentService.markInTransit(activeMission.id, coords?.latitude, coords?.longitude);
    }

    const result = await DeliveryAssignmentService.markDelivered(assignmentId, stop.id, proof.type, proof.otpCode);
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

  const logout = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <PhoneFrame>
        {screen === "dashboard" && (
          <div className="flex h-full flex-col">
            <header className="flex items-center justify-between px-5 pt-6">
              <FreshOnLogo />
              <div className="flex items-center gap-2">
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

            <div className="space-y-4 px-5 pb-28 pt-5">
              <StatusToggle online={online} onChange={updateOnline} />
              <EarningsHeader stats={earnings} />
              {trip ? (
                <ActiveTripCard trip={trip} onOpen={() => setScreen("mission")} />
              ) : online && availableTrips.length > 0 ? (
                <AvailableTripCard
                  trip={availableTrips[0]}
                  count={availableTrips.length}
                  busy={tripBusy}
                  onAccept={() => acceptTrip(availableTrips[0])}
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
              <div className="px-5 pb-28 pt-4">
                <TripView
                  trip={trip}
                  rider={riderPos}
                  busy={tripBusy}
                  onConfirmPickup={confirmTripPickup}
                  onReoptimize={reoptimizeTrip}
                  onOpenStop={openTripStop}
                />
              </div>
            ) : activeMission ? (
              <div className="space-y-4 px-5 pb-28 pt-4">
                <DeliveryMap
                  stops={activeMission.stops.map((s) => ({
                    latitude: s.latitude ?? null,
                    longitude: s.longitude ?? null,
                    type: s.type,
                    label: s.label,
                    sequence: s.sequence ?? 0,
                    is_completed: completedStopIds.has(s.id),
                  }))}
                  rider={riderPos}
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
                  onPickup={confirmPickup}
                />
                <FeeBreakdown mission={activeMission} />
              </div>
            ) : null}

            <BottomNav active="map" onMission={() => setScreen("mission")} />
          </div>
        )}
      </PhoneFrame>

      <ProofDrawer stop={openStop} onClose={() => setOpenStop(null)} onComplete={completeStop} />
    </main>
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

const AvailableTripCard = ({ trip, count, busy, onAccept }: { trip: DeliveryTrip; count: number; busy?: boolean; onAccept: () => void }) => {
  const dropoffs = trip.stops.filter((s) => s.type === "dropoff");
  return (
    <div className="rounded-3xl glass p-5 shadow-card-soft animate-slide-up">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-amber px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent-foreground shadow-glow-amber">
          <Package className="h-3.5 w-3.5" /> {count} trip{count === 1 ? "" : "s"} ready
        </span>
        <span className="text-xs text-muted-foreground">Batched & optimized</span>
      </div>
      <div className="mt-3 text-xl font-extrabold text-foreground">{dropoffs.length} orders · {Number(trip.total_distance_km).toFixed(1)} km</div>
      <div className="text-sm text-muted-foreground">~{trip.total_duration_min} min from {trip.hub?.label || "hub"}</div>
      <button
        onClick={onAccept}
        disabled={busy}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-5 py-3.5 text-sm font-bold text-primary-foreground shadow-glow-primary disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Accept trip <ArrowRight className="h-4 w-4" />
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
    <nav className="sticky bottom-0 left-0 right-0 mt-auto px-4 pb-4">
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
