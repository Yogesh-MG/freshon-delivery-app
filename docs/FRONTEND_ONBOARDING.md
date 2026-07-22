# Delivery App — Frontend Onboarding

Welcome! This is the **FreshOn Delivery Partner app** (`freshon-delivery-app`) —
a React + Vite + TypeScript mobile-first web app wrapped in Tauri for
Android/desktop. This guide is everything a **frontend** contributor needs: how
we talk to the backend, how we use the shared `@freshon/api` package, the backend
routes we call, and the exact response shapes you'll get back.

You do **not** need the Django backend source to work here. Point the app at a
running backend via one env var and build against the contract below.

---

## 1. Scope of your access

| You have | You do **not** need |
| --- | --- |
| `Del_app/` (this repo/folder — the whole frontend) | `Freshon-Cloud-Deploy/backend/` (Django source) |
| `packages/freshon-api/` — read the compiled `dist/` + `src/` types for reference | Backend deploy / DB / infra |
| A backend URL to hit (dev or prod) — set in `.env` | Server-side secrets |

The backend is a black box you call over HTTPS. The **contract** (routes +
request/response shapes) is documented in §4–§5 below and typed in
[`src/lib/types.ts`](../src/lib/types.ts).

---

## 2. Local setup

```bash
# from Del_app/
bun install          # or: npm install
bun run dev          # vite dev server at http://localhost:5173
```

Create `.env` (already present in the repo as a template):

```bash
VITE_API_URL=https://api.freshon.in/     # backend base URL — trailing slash ok
VITE_WS_URL=wss://api.freshon.in/        # websocket base
VITE_GOOGLE_MAPS_API_KEY=...             # for maps
```

- `VITE_API_URL` defaults to `http://localhost:8000` if unset (see
  [`apiClient.ts:13`](../src/lib/apiClient.ts)). Point it at a shared dev backend
  or a local one — your choice, ask the team for a dev URL.
- Everything is a normal Vite app: `bun run build`, `bun run lint`,
  `bun run test` (Vitest).

---

## 3. Two API layers — know which is which

This is the single most important thing to understand. The delivery app has
**two** ways it reaches the network, and they are used for different things.

### Layer A — Local `src/lib/` services (this is where 95% of your work is)

All **delivery-specific** backend calls go through the app's own thin client and
typed service classes in [`src/lib/`](../src/lib/):

```
src/lib/
  apiClient.ts                  # fetch wrapper: base URL, auth header, 401 refresh
  types.ts                      # request/response types (Assignment, Stop, ApiResult…)
  backendAuthService.ts         # OTP login, device-key session, current user
  deliveryAssignmentService.ts  # accept / pickup / transit / deliver a mission
  deliveryTripService.ts        # multi-stop trips
  deliveryStatusService.ts      # online/offline + GPS push
  deliveryWalletService.ts      # wallet balance + withdrawals
  deliveryPartnerService.ts     # profile + KYC docs + earnings
  cashDropService.ts            # COD cash reconciliation
  deliverySocket.ts             # live websocket updates
```

Every service returns the app-wide `ApiResult<T>` shape (see §5). You call these
from pages/components — you rarely touch `apiClient` directly.

### Layer B — Centralized `@freshon/api` package (shared across ALL FreshOn apps)

`@freshon/api` is a **monorepo-shared TypeScript SDK** used by every FreshOn app
(Consumer, Delivery, Farmer, Picker, POS, FOS, Website). It lives at
`packages/freshon-api/` and is wired into this app via a **Vite alias**, not npm:

```ts
// vite.config.ts:45
"@freshon/api": path.resolve(__dirname, "../packages/freshon-api/dist"),
```

> ⚠️ **We import from `dist/` (compiled), not `src/`.** If you edit the package
> source you must rebuild it (`npm run build` inside `packages/freshon-api/`)
> before this app sees the change. As a frontend contributor you'll mostly
> **consume** this package, not edit it.

**What the delivery app currently uses from it:** just the OTA self-updater.

```ts
// src/App.tsx:16
import { createOtaUpdater } from "@freshon/api/ota";

const ota = createOtaUpdater({
  app: "del",
  baseUrl: "https://api.freshon.in/ota",
  currentVersion: import.meta.env.VITE_BUNDLE_VERSION ?? "0",
  nativeVersion: "1.0.0",
  invoke,
});
```

**What else the package offers** (importable as subpath modules — see
`packages/freshon-api/package.json` `exports`):

| Import | What it is |
| --- | --- |
| `@freshon/api` | Core: `initClient()`, `auth`, `orders`, `inventory`, `wallet`, `ws`, … + all shared types |
| `@freshon/api/ota` | Over-the-air web-bundle updater (what we use) |
| `@freshon/api/delivery-partner` | Shared delivery assignment/proof module *(backend still being unified — Del_app uses its own `lib/` version for now)* |
| `@freshon/api/branding` | Logo / brand assets, single source of truth |
| `@freshon/api/receipt` | Thermal receipt formatting |
| `@freshon/api/ws` | Reconnecting WebSocket manager |

> **Rule of thumb:** for **delivery features**, use the local `src/lib/`
> services. For **cross-app concerns** (OTA, branding, receipts, shared types),
> reach for `@freshon/api`. When in doubt, follow the existing pattern in the
> file you're editing and ask before introducing the centralized client for a
> delivery endpoint — that migration is coordinated at the platform level.

---

## 4. The backend contract — URL routes

**Base URL:** `VITE_API_URL` (e.g. `https://api.freshon.in/`). All paths below are
appended to it. Everything is JSON. Auth-protected routes need the
`Authorization: Bearer <device_auth_key>` header, which `apiClient` adds for you
automatically once you're logged in.

### Auth (`/api/auth/*`)

| Method | Path | Body | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/send-otp/` | `{ phone }` | Send login OTP |
| POST | `/api/auth/verify-otp/` | `{ phone, otp }` | Verify → returns device key + user |
| POST | `/api/auth/token/refresh/` | `{ refresh }` | Silent token refresh (auto, on 401) |
| POST | `/api/auth/logout/` | — | Invalidate session |

### Delivery Partner (`/api/delivery-partner/*`)

| Method | Path | Purpose |
| --- | --- | --- |
| GET  | `/api/delivery-partner/me/` | Current partner (device-key authed) |
| GET/PATCH | `/api/delivery-partner/profile/` | Profile (vehicle, address) |
| POST | `/api/delivery-partner/documents/` | KYC document upload |
| POST | `/api/delivery-partner/status/` | Go online/offline + push GPS |
| GET  | `/api/delivery-partner/assignments/` | List assigned missions |
| POST | `/api/delivery-partner/assignments/{id}/accept/` | Accept a mission |
| POST | `/api/delivery-partner/assignments/{id}/pickup/` | Confirm pickup (`{ handover_code }`) |
| POST | `/api/delivery-partner/assignments/{id}/transit/` | Mark in-transit (`{ latitude, longitude }`) |
| POST | `/api/delivery-partner/assignments/{id}/deliver/` | Proof of delivery (`{ stop_id, type, otp_code, latitude, longitude }`) |
| POST | `/api/delivery-partner/assignments/{id}/resend-otp/` | Resend delivery OTP |
| GET  | `/api/delivery-partner/trips/active/` · `/trips/available/` | Multi-stop trips |
| POST | `/api/delivery-partner/trips/{id}/accept/` · `/pickup/` · `/cancel/` · `/reoptimize/` · `/scan-bag/` | Trip lifecycle |
| GET  | `/api/delivery-partner/earnings/` · `/earnings/history/?days=N` | Earnings |
| GET  | `/api/delivery-partner/wallet/` | Wallet balance |
| POST | `/api/delivery-partner/wallet/withdraw/` | Request withdrawal |
| GET  | `/api/delivery-partner/wallet/withdrawals/` | Withdrawal history |
| POST | `/api/delivery-partner/cash/drop/` · GET `/cash/drop/{id}/status/` | COD cash reconciliation |

> The full server-side definition lives in the backend at
> `apps/delivery_partner/urls.py` (you don't need it, but that's the source of
> truth if a route is ever ambiguous).

---

## 5. How responses look

### 5a. Transport-level shape (`apiClient`)

Every raw call resolves to `ApiResponse<T>`
([`apiClient.ts:1`](../src/lib/apiClient.ts)):

```ts
interface ApiResponse<T> {
  data?: T;       // present on 2xx
  error?: string; // present on failure — server's message, extracted for you
  status: number; // HTTP status, or 0 for a network/offline error
}
```

On a non-2xx the client pulls the human-readable reason from the body in this
order: `error` → `detail` → `message` → `"Request failed"`. So a Django DRF
`{ "detail": "Not found." }` reaches you as `response.error === "Not found."`.

**Auth is automatic:** `apiClient` attaches `Authorization: Bearer <key>` and the
`X-App-Platform: DeliveryApp` header. On a `401` it silently calls
`/api/auth/token/refresh/` once and retries; if that fails it clears the session
and fires a `freshon:auth-expired` window event that routes the rider back to
login.

### 5b. App-level shape (`*Service` classes)

Service methods wrap that into the friendlier `ApiResult<T>`
([`types.ts:56`](../src/lib/types.ts)) — this is what your components consume:

```ts
interface ApiResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### 5c. Worked example — the assignment flow

Request:

```ts
import { DeliveryAssignmentService } from "@/lib/deliveryAssignmentService";

const res = await DeliveryAssignmentService.getAssignments();
if (res.success) {
  res.data // → Assignment[]
} else {
  toast.error(res.error);
}
```

The backend returns an array of `Assignment` (typed in `types.ts`):

```jsonc
// GET /api/delivery-partner/assignments/  → 200
[
  {
    "id": "a1b2c3",
    "service": "swift",                    // "swift" | "next-day" | "standard"
    "earnings": 82.5,
    "distance_km": 4.3,
    "weight_kg": 6.1,
    "status": "PENDING",                   // PENDING→ACCEPTED→PICKED_UP→IN_TRANSIT→DELIVERED
    "fee": { "weight": 20, "distance": 47.5, "premium": 15 },
    "stops": [
      {
        "id": "s1", "type": "pickup", "label": "Hub — Koramangala",
        "address": "…", "eta": "10:20", "latitude": 12.93, "longitude": 77.62,
        "sequence": 0, "is_completed": false
      },
      {
        "id": "s2", "type": "dropoff", "label": "Drop 1", "customer": "Asha",
        "address": "…", "eta": "10:40", "assignment_id": "a1b2c3",
        "items": [{ "name": "Tomato 1kg", "qty": 1, "weight": "1kg" }]
      }
    ]
  }
]
```

Login response shape ([`backendAuthService.ts`](../src/lib/backendAuthService.ts)):

```jsonc
// POST /api/auth/verify-otp/  { phone, otp }  → 200
{
  "device_auth_key": "…",                  // long-lived (~90d) key — stored, used as Bearer
  "device_auth_key_expires": "2026-10-20T…",
  "user": { "id": 12, "username": "…", "role": "DELIVERY", "is_profile_complete": true }
}
```

> Only `role === "DELIVERY"` accounts are allowed in — the service rejects any
> other role client-side. Note delivery uses a **device auth key** (not the
> short-lived JWT cookie), because webviews drop cookies; `/api/delivery-partner/me/`
> re-validates it on launch.

---

## 6. Where to start reading

1. [`src/App.tsx`](../src/App.tsx) — routes, providers, OTA wiring.
2. [`src/hooks/useAuth.tsx`](../src/hooks/useAuth.tsx) — session/bootstrap.
3. [`src/lib/apiClient.ts`](../src/lib/apiClient.ts) — the fetch wrapper (read once).
4. [`src/lib/deliveryAssignmentService.ts`](../src/lib/deliveryAssignmentService.ts) — the cleanest example of the service pattern; copy it when adding a new endpoint.
5. [`src/pages/`](../src/pages/) — the screens that consume the services.

**Adding a new backend call?** Add a typed method to the relevant `*Service`
class, add its request/response types to `types.ts`, and return `ApiResult<T>`.
Don't call `fetch` or `apiClient` directly from a component.
