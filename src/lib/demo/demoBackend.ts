/**
 * In-memory fake backend for demo mode. Answers the delivery-partner endpoints
 * the rider journey touches, holding trip state in module scope so the flow
 * advances exactly like the real thing:
 *
 *   pool → accept → scan each bag → confirm hub pickup → deliver each stop →
 *   trip completes, earnings bump, rider drops back to the pool
 *
 * Every gate the real backend enforces is enforced here too (you cannot confirm
 * pickup with an unscanned bag, cannot deliver before pickup) — the difference
 * is that the bag QR and the customer OTP accept anything, since neither exists
 * in a browser. Endpoints not listed here return null so apiClient falls through
 * to the real network.
 *
 * Dev-only: reachable solely through isDemoMode(), which is constant-false in
 * production builds.
 */

import type { ApiResponse } from "../apiClient";
import { tripKm } from "../deliveryTripService";
import type { DeliveryTrip, TripStop } from "../deliveryTripService";
import type { Assignment, EarningsStats } from "../types";
import type { KycDocumentsResponse } from "../deliveryPartnerService";

// ── Seed data ────────────────────────────────────────────────────────────────

const HUB = {
    label: "FreshOn Hub · Koramangala",
    address: "80 Feet Rd, Koramangala 4th Block, Bengaluru 560034",
    latitude: 12.9352,
    longitude: 77.6245,
};

interface DropSeed {
    customer: string;
    phone: string;
    label: string;
    address: string;
    lat: number;
    lng: number;
    eta: string;
    notes?: string;
    items: { name: string; qty: number; unit: string; weight_grams: number | null; fragile?: boolean }[];
}

const DROPS: DropSeed[] = [
    {
        customer: "Ananya Rao",
        phone: "+91 98450 11234",
        label: "Ananya Rao",
        address: "12, 100 Feet Rd, Indiranagar, Bengaluru",
        lat: 12.9784,
        lng: 77.6408,
        eta: "9:40 AM",
        notes: "Gate code 4421 — please ring the bell twice.",
        items: [
            { name: "Alphonso Mangoes", qty: 2, unit: "kg", weight_grams: 1000 },
            { name: "Farm Eggs (tray)", qty: 1, unit: "tray", weight_grams: 700, fragile: true },
        ],
    },
    {
        customer: "Vikram Shetty",
        phone: "+91 99016 55801",
        label: "Vikram Shetty",
        address: "Sector 2, HSR Layout, Bengaluru",
        lat: 12.9121,
        lng: 77.6446,
        eta: "10:05 AM",
        items: [
            { name: "Baby Spinach", qty: 3, unit: "bunch", weight_grams: 250 },
            { name: "Cold-pressed Juice", qty: 2, unit: "bottle", weight_grams: 500, fragile: true },
        ],
    },
    {
        customer: "Meera Krishnan",
        phone: "+91 80889 43120",
        label: "Meera Krishnan",
        address: "16th Main, BTM Layout 2nd Stage, Bengaluru",
        lat: 12.9166,
        lng: 77.6101,
        eta: "10:30 AM",
        notes: "Leave with the security desk if nobody answers.",
        items: [{ name: "Organic Tomatoes", qty: 2, unit: "kg", weight_grams: 1000 }],
    },
    {
        customer: "Rahul Nair",
        phone: "+91 73496 20077",
        label: "Rahul Nair",
        address: "4th Block, Jayanagar, Bengaluru",
        lat: 12.925,
        lng: 77.5938,
        eta: "10:55 AM",
        items: [
            { name: "Curd (1L)", qty: 2, unit: "pack", weight_grams: 1000, fragile: true },
            { name: "Banana Leaf", qty: 5, unit: "pc", weight_grams: 60 },
        ],
    },
    {
        customer: "Divya Menon",
        phone: "+91 90350 88412",
        label: "Divya Menon",
        address: "Ejipura Main Rd, Bengaluru",
        lat: 12.9401,
        lng: 77.628,
        eta: "9:25 AM",
        items: [{ name: "Sourdough Loaf", qty: 1, unit: "pc", weight_grams: 800 }],
    },
];

const makeStops = (tripId: string, drops: DropSeed[]): TripStop[] => [
    {
        id: `${tripId}-hub`,
        type: "pickup",
        label: HUB.label,
        address: HUB.address,
        eta: "9:00 AM",
        latitude: HUB.latitude,
        longitude: HUB.longitude,
        sequence: 0,
        is_completed: false,
        bag_scanned: false,
        assignment: null,
        order_id: null,
        customer_phone: "",
        weight_kg: null,
        parcel_count: 0,
    },
    ...drops.map((d, i) => ({
        id: `${tripId}-s${i + 1}`,
        type: "dropoff" as const,
        label: d.label,
        address: d.address,
        customer: d.customer,
        customer_phone: d.phone,
        eta: d.eta,
        notes: d.notes,
        latitude: d.lat,
        longitude: d.lng,
        sequence: i + 1,
        is_completed: false,
        bag_scanned: false,
        assignment: `${tripId}-a${i + 1}`,
        order_id: `FRSH-${tripId.slice(-4).toUpperCase()}${i + 1}`,
        weight_kg: Math.round(d.items.reduce((sum, it) => sum + (it.weight_grams ?? 0) * it.qty, 0)) / 1000,
        parcel_count: d.items.reduce((sum, it) => sum + it.qty, 0),
        items: d.items,
    })),
];

const makeTrip = (
    id: string,
    drops: DropSeed[],
    distanceKm: number,
    durationMin: number,
    earnings: number,
): DeliveryTrip => ({
    id,
    status: "PENDING",
    // Serialized as a decimal string, exactly as the live API sends it — a
    // number here would hide bugs like calling .toFixed() on the raw field.
    total_distance_km: distanceKm.toFixed(2),
    total_duration_min: durationMin,
    stop_count: drops.length,
    // Left empty on purpose: DeliveryMap falls back to live OSRM routing, so the
    // demo draws a real road route instead of a canned polyline.
    encoded_polyline: "",
    is_optimized: true,
    earnings,
    hub: HUB,
    stops: makeStops(id, drops),
});

const seedTrips = (): DeliveryTrip[] => [
    makeTrip("demo-batch-1", [DROPS[0], DROPS[1], DROPS[2]], 14.2, 46, 212),
    makeTrip("demo-batch-2", [DROPS[3], DROPS[4], DROPS[0], DROPS[1]], 19.8, 61, 286),
    makeTrip("demo-single-1", [DROPS[4]], 3.4, 12, 58),
    makeTrip("demo-single-2", [DROPS[2]], 5.1, 17, 74),
];

// ── Mutable state ────────────────────────────────────────────────────────────

interface DemoState {
    online: boolean;
    trips: DeliveryTrip[];
    activeTripId: string | null;
    earnings: EarningsStats;
}

const freshState = (): DemoState => ({
    online: false,
    trips: seedTrips(),
    activeTripId: null,
    earnings: { earnings: 480, goal: 1500, deliveries: 4, distance: 21.6, rating: 2 },
});

const state = freshState();

const activeTrip = () => {
    const trip = state.trips.find((t) => t.id === state.activeTripId);
    if (!trip || trip.status === "COMPLETED" || trip.status === "CANCELLED") return null;
    return trip;
};

const dropoffsOf = (trip: DeliveryTrip) => trip.stops.filter((s) => s.type === "dropoff");

// ── Response helpers ─────────────────────────────────────────────────────────

const ok = <T>(data: T): ApiResponse<T> => ({ status: 200, data: data as T });
const fail = <T>(error: string, status = 400): ApiResponse<T> => ({ status, error });

/** Fake network latency, so spinners and disabled states are actually visible. */
const latency = () => new Promise<void>((resolve) => setTimeout(resolve, 260));

const parseBody = (body: BodyInit | null | undefined): Record<string, unknown> => {
    if (typeof body !== "string") return {};
    try {
        return JSON.parse(body) as Record<string, unknown>;
    } catch {
        return {};
    }
};

// ── Router ───────────────────────────────────────────────────────────────────

const TRIP_ACTION = /^\/api\/delivery-partner\/trips\/([^/]+)\/(accept|pickup|scan-bag|cancel|reoptimize)\/$/;
const ASSIGNMENT_ACTION = /^\/api\/delivery-partner\/assignments\/([^/]+)\/(accept|pickup|transit|deliver|resend-otp)\/$/;

/**
 * Answer a request from demo state, or return null to let apiClient hit the
 * real network. `endpoint` is the path as passed to apiClient (may carry a
 * query string).
 */
export async function handleDemoRequest<T>(
    endpoint: string,
    method: string,
    body: BodyInit | null | undefined,
): Promise<ApiResponse<T> | null> {
    const path = endpoint.split("?")[0];
    if (!path.startsWith("/api/delivery-partner/") && !path.startsWith("/api/auth/")) return null;

    await latency();

    // ── Session ────────────────────────────────────────────────────────────────
    if (path === "/api/delivery-partner/me/") {
        return ok({
            id: 1,
            username: "demo_rider",
            email: "demo.rider@freshon.in",
            role: "DELIVERY",
            is_profile_complete: true,
        }) as ApiResponse<T>;
    }

    if (path === "/api/auth/logout/") return ok({}) as ApiResponse<T>;

    // KYC — fully verified, so the online toggle is available rather than gated.
    if (path === "/api/delivery-partner/documents/" && method === "GET") {
        const docs: KycDocumentsResponse = {
            documents: (
                [
                    ["aadhaar", "Aadhaar"],
                    ["pan", "PAN"],
                    ["driving_licence", "Driving Licence"],
                    ["vehicle_rc", "Vehicle RC"],
                    ["insurance", "Insurance"],
                ] as const
            ).map(([type, display], i) => ({
                id: `demo-doc-${i}`,
                doc_type: type,
                doc_type_display: display,
                doc_number: `DEMO${1000 + i}`,
                file: "",
                file_url: null,
                status: "verified" as const,
                status_display: "Verified",
                uploaded_at: "2026-01-04T09:00:00Z",
                verified_at: "2026-01-05T11:30:00Z",
                rejection_reason: "",
            })),
            kyc_status: {
                required_count: 5,
                uploaded_count: 5,
                is_complete: true,
                missing_documents: [],
            },
        };
        return ok(docs) as ApiResponse<T>;
    }

    // ── Status / earnings ──────────────────────────────────────────────────────
    if (path === "/api/delivery-partner/status/" && method === "PATCH") {
        state.online = parseBody(body).online === true;
        return ok({ online: state.online }) as ApiResponse<T>;
    }

    if (path === "/api/delivery-partner/earnings/" && method === "GET") {
        return ok(state.earnings) as ApiResponse<T>;
    }

    if (path === "/api/delivery-partner/proof/" && method === "POST") {
        return ok({ url: "https://demo.freshon.in/proof/demo.jpg" }) as ApiResponse<T>;
    }

    // ── Trips ──────────────────────────────────────────────────────────────────
    if (path === "/api/delivery-partner/trips/active/" && method === "GET") {
        return ok({ trip: activeTrip() }) as ApiResponse<T>;
    }

    if (path === "/api/delivery-partner/trips/available/" && method === "GET") {
        // A rider already holding a trip sees an empty pool, same as production.
        const pool = activeTrip() ? [] : state.trips.filter((t) => t.status === "PENDING");
        return ok({ trips: pool }) as ApiResponse<T>;
    }

    const tripMatch = TRIP_ACTION.exec(path);
    if (tripMatch && method === "POST") {
        const [, tripId, action] = tripMatch;
        const trip = state.trips.find((t) => t.id === tripId);
        if (!trip) return fail<T>("Trip not found", 404);

        switch (action) {
            case "accept": {
                if (activeTrip()) return fail<T>("You already have an active trip");
                trip.status = "ASSIGNED";
                state.activeTripId = trip.id;
                return ok({ trip }) as ApiResponse<T>;
            }

            case "scan-bag": {
                const code = String(parseBody(body).code ?? "").trim();
                if (!code) return fail<T>("No code read — try again");
                // Any code passes in demo; the real backend matches it to a bag.
                const next = dropoffsOf(trip).find((s) => !s.bag_scanned);
                if (!next) return fail<T>("Every bag on this trip is already scanned");
                next.bag_scanned = true;
                return ok({ trip }) as ApiResponse<T>;
            }

            case "pickup": {
                const unscanned = dropoffsOf(trip).filter((s) => !s.bag_scanned);
                if (unscanned.length > 0) {
                    return fail<T>(`${unscanned.length} bag(s) still unscanned`);
                }
                trip.status = "ACTIVE";
                trip.stops.forEach((s) => {
                    if (s.type === "pickup") s.is_completed = true;
                });
                return ok({ trip }) as ApiResponse<T>;
            }

            case "reoptimize": {
                // Re-sequence whatever is still undelivered, so the list and the drawn
                // route visibly change.
                const remaining = dropoffsOf(trip).filter((s) => !s.is_completed);
                [...remaining].reverse().forEach((stop, i) => {
                    stop.sequence = i + 1;
                });
                trip.stops.sort((a, b) => a.sequence - b.sequence);
                trip.total_distance_km = (tripKm(trip) * 0.94).toFixed(2);
                trip.total_duration_min = Math.max(5, Math.round(trip.total_duration_min * 0.94));
                return ok({ trip }) as ApiResponse<T>;
            }

            case "cancel": {
                // Back to the pool, scans and progress discarded.
                trip.status = "PENDING";
                trip.stops.forEach((s) => {
                    s.is_completed = false;
                    s.bag_scanned = false;
                });
                state.activeTripId = null;
                return ok({}) as ApiResponse<T>;
            }
        }
    }

    // ── Assignments ────────────────────────────────────────────────────────────
    // Demo seeds trips only, so the legacy single-mission list is empty.
    if (path === "/api/delivery-partner/assignments/" && method === "GET") {
        return ok([] as Assignment[]) as ApiResponse<T>;
    }

    const assignmentMatch = ASSIGNMENT_ACTION.exec(path);
    if (assignmentMatch && method === "POST") {
        const [, , action] = assignmentMatch;

        if (action === "resend-otp") return ok({}) as ApiResponse<T>;
        if (action === "transit" || action === "pickup" || action === "accept") return ok({}) as ApiResponse<T>;

        if (action === "deliver") {
            const trip = activeTrip();
            if (!trip) return fail<T>("No active trip");
            if (trip.status !== "ACTIVE") return fail<T>("Confirm hub pickup before delivering");

            const stopId = String(parseBody(body).stop_id ?? "");
            const stop = trip.stops.find((s) => s.id === stopId);
            if (!stop) return fail<T>("Stop not found on this trip", 404);
            if (stop.is_completed) return fail<T>("This stop is already delivered");

            // Any OTP passes in demo — the customer's real code isn't reachable here.
            stop.is_completed = true;

            const drops = dropoffsOf(trip);
            if (drops.every((s) => s.is_completed)) {
                trip.status = "COMPLETED";
                state.activeTripId = null;
                state.earnings = {
                    ...state.earnings,
                    earnings: state.earnings.earnings + (trip.earnings ?? 0),
                    deliveries: state.earnings.deliveries + drops.length,
                    distance: Math.round((state.earnings.distance + tripKm(trip)) * 10) / 10,
                };
            }
            return ok({}) as ApiResponse<T>;
        }
    }

    // ── Read-only stubs, so Profile/Earnings don't error out in demo ───────────
    if (path === "/api/delivery-partner/profile/") {
        return ok({
            id: 1,
            username: "demo_rider",
            name: "Demo Rider",
            phone: "+91 90000 00000",
            vehicle_type: "BIKE",
            vehicle_number: "KA 05 DE 1234",
            address: "Koramangala 4th Block",
            city: "Bengaluru",
            pincode: "560034",
            payout_method: "UPI",
            bank_upi: "demo@upi",
            bank_account_name: "",
            bank_account_number: "",
            bank_ifsc: "",
            is_online: state.online,
            total_deliveries: state.earnings.deliveries,
            total_earnings: state.earnings.earnings,
            rating: state.earnings.rating,
        }) as ApiResponse<T>;
    }

    if (path === "/api/delivery-partner/earnings/history/" && method === "GET") {
        const days = 7;
        const daily = Array.from({ length: days }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (days - 1 - i));
            return {
                date: date.toISOString().slice(0, 10),
                earnings: 320 + i * 47,
                deliveries: 4 + (i % 3),
                distance: 12 + i * 2.4,
            };
        });
        return ok({
            period: { start: daily[0].date, end: daily[daily.length - 1].date, days },
            summary: {
                total_earnings: daily.reduce((sum, d) => sum + d.earnings, 0),
                total_deliveries: daily.reduce((sum, d) => sum + d.deliveries, 0),
                total_distance: Math.round(daily.reduce((sum, d) => sum + d.distance, 0) * 10) / 10,
            },
            daily_breakdown: daily,
            lifetime: { total_earnings: 42800, total_deliveries: 391, rating: state.earnings.rating },
            recent_deliveries: daily.slice(-4).map((d, i) => ({
                id: `demo-rd-${i}`,
                date: d.date,
                earnings: d.earnings / Math.max(1, d.deliveries),
                distance: d.distance,
                service: (["swift", "standard", "next-day"] as const)[i % 3],
            })),
        }) as ApiResponse<T>;
    }

    if (path === "/api/delivery-partner/wallet/" && method === "GET") {
        return ok({
            available: "1840.00",
            pending: "460.00",
            total_earned: "42800.00",
            total_withdrawn: "40500.00",
            hold_hours: 24,
            next_matures_at: null,
            transactions: [],
        }) as ApiResponse<T>;
    }

    if (path === "/api/delivery-partner/wallet/withdrawals/" && method === "GET") {
        return ok([]) as ApiResponse<T>;
    }

    return null;
}
