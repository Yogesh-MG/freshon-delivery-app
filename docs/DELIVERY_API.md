# Delivery App — API Reference

Every network call this app makes, with the data it returns.

Base URL comes from `VITE_API_URL` (`.env`), currently `https://api.freshon.in/`.
All `/api/delivery-partner/*` routes require `Authorization: Bearer <device_auth_key>`;
unauthenticated requests get `401 {"detail":"Authentication credentials were not provided."}`.
Every request also carries `X-App-Platform: DeliveryApp`.

**Confidence column** — `verified` means the response shape was observed from the live
server. `declared` means it's the TypeScript interface in `src/lib/`, which has not been
checked against a real response and may be wrong (see the `total_distance_km` note below).

> ### How to fill in the unverified JSON
>
> Response shapes can't be read from outside the app: every route is auth-gated and
> `/api/schema/`, `/api/docs/`, `/swagger/`, `/redoc/` all 404. The app records them
> instead.
>
> 1. `npm run dev`, sign in as a rider (demo mode **off**).
> 2. Use the app — go online, open a trip, view Earnings, Profile, Wallet. Each screen
>    you visit captures its endpoints.
> 3. Tap the `dev` pill → **Export N endpoints**. The JSON goes to the clipboard *and*
>    to the console under `─── FreshOn API capture ───`.
>
> One real request/response per endpoint, ids collapsed so repeats share a slot, and
> tokens/passwords redacted. Paste the result back into this file to promote sections
> from `declared` to `verified`.

---

## 1. Auth

| Method | Path | Request | Returns |
| --- | --- | --- | --- |
| POST | `/api/auth/send-otp/` | `{ phone }` | `{ phone, message }` |
| POST | `/api/auth/verify-otp/` | `{ phone, otp }` | `{ device_auth_key, device_auth_key_expires, user }` |
| GET | `/api/delivery-partner/me/` | — | `DeliveryAuthUser` |
| POST | `/api/auth/logout/` | — | — |

`verify-otp` returns a **90-day device key**, not a short JWT — it's stored as
`freshon_delivery_access` and reused for the WebSocket. The client rejects any user whose
`role !== "DELIVERY"`.

```ts
DeliveryAuthUser {
  id: number; username: string; email: string;
  role: "DELIVERY" | "PICKER" | "ADMIN" | "CUSTOMER" | "FARMER" | "POS_OPERATOR";
  is_profile_complete?: boolean;
}
```

> ⚠️ **Inferred from the TypeScript interface — never observed.** Field names, types and
> nullability may all be wrong. Run the API capture (see top) to replace this with real JSON.

```json
// POST /api/auth/send-otp/   → 200
{ "phone": "+919900242455", "message": "OTP sent" }

// POST /api/auth/verify-otp/  → 200
{
  "device_auth_key": "«90-day opaque key»",
  "device_auth_key_expires": "2026-10-22T09:14:00Z",
  "user": {
    "id": 42,
    "username": "rider_9900242455",
    "email": "",
    "role": "DELIVERY",
    "is_profile_complete": true
  }
}

// GET /api/delivery-partner/me/  → 200
{ "id": 42, "username": "rider_9900242455", "email": "", "role": "DELIVERY", "is_profile_complete": true }
```

Confidence: **declared**.

---

## 2. Trips — the main rider flow

| Method | Path | Request | Returns |
| --- | --- | --- | --- |
| GET | `/trips/available/` | — | `{ trips: DeliveryTrip[] }` |
| GET | `/trips/active/` | — | `{ trip: DeliveryTrip \| null }` |
| POST | `/trips/{id}/accept/` | — | `{ trip }` |
| POST | `/trips/{id}/pickup/` | — | `{ trip }` |
| POST | `/trips/{id}/scan-bag/` | `{ code }` | `{ trip }` |
| POST | `/trips/{id}/reoptimize/` | — | `{ trip }` |
| POST | `/trips/{id}/cancel/` | — | — |

Confidence: **verified** — the JSON below is a real `GET /trips/available/` response,
unedited apart from truncating the trip list.

```json
{
  "trips": [
    {
      "id": "c2fcc60c-4dc1-4bd7-96e3-3964849c95d3",
      "status": "PENDING",
      "total_distance_km": "14.46",
      "total_duration_min": 39,
      "stop_count": 1,
      "encoded_polyline": "",
      "is_optimized": true,
      "earnings": 126.76,
      "hub": {
        "label": "FreshOn Main Hub",
        "address": "",
        "latitude": 12.965584,
        "longitude": 77.50456
      },
      "stops": [
        {
          "id": "hub-71a9c5b2-a199-47a7-8b4c-a06a518b5be7",
          "type": "pickup",
          "label": "FreshOn Main Hub",
          "address": "",
          "latitude": 12.965584,
          "longitude": 77.50456,
          "sequence": 0,
          "is_completed": false,
          "customer": "",
          "eta": "",
          "notes": "",
          "assignment": null,
          "order_id": null,
          "customer_phone": "",
          "weight_kg": null,
          "parcel_count": 0
        },
        {
          "id": "322bf49c-f5dc-464d-b4cd-3eaefdd18fb1",
          "type": "dropoff",
          "label": "Current Location",
          "address": "Devarachikkanahalli",
          "customer": "Shailaja Manjunath",
          "eta": "",
          "notes": "",
          "latitude": 12.894016,
          "longitude": 77.615992,
          "sequence": 1,
          "is_completed": false,
          "assignment": "483840a5-953c-454f-b560-f416a64f42d1",
          "bag_scanned": false,
          "order_id": "FRSH-2FC946",
          "customer_phone": "9900242455",
          "weight_kg": 8.21,
          "parcel_count": 9
        }
      ]
    }
  ]
}
```

Field notes:

- `total_distance_km` — ⚠️ decimal **string**, not a number.
- `stop_count` — counts drop-offs only; `stops[]` also contains the hub, so a 1-drop trip
  has `stop_count: 1` and `stops.length === 2`.
- `encoded_polyline` — empty in practice, so the map falls back to live OSRM routing.
- `earnings` — a real number here, unlike the distance.
- `bag_scanned` — present on drop-offs, **absent** on the hub stop.
- Long addresses arrive with embedded `\n`, e.g.
  `"T U SHRUTHI \nDoor no 11-22-34/41, K.H.B colony\n2nd cross Jyothi nagar, Kulshekar \nMangalore -575005"`.

`/trips/active/` returns `{ "trip": … }` — the same object, or `null`. The `accept`,
`pickup`, `scan-bag` and `reoptimize` responses are all `{ "trip": … }` with the same shape;
their exact JSON is **not yet verified**.

### Stop object

| Field | Hub (`type:"pickup"`) | Drop-off (`type:"dropoff"`) |
| --- | --- | --- |
| `id` | `"hub-<uuid>"` | order stop uuid |
| `label` | hub name | address label — `"Home"`, `"Current Location"` |
| `address` | `""` (empty) | full address, **may contain `\n`** |
| `customer` | `""` | customer name |
| `customer_phone` | `""` | **`"9900242455"`** — dialable |
| `weight_kg` | `null` | **`8.21`** — authoritative load |
| `parcel_count` | `0` | `9` |
| `order_id` | `null` | `"FRSH-2FC946"` |
| `assignment` | `null` | assignment uuid — target for `deliver/` |
| `bag_scanned` | *absent* | `false` |
| `eta` / `notes` | `""` | `""` — empty in practice |
| `latitude` / `longitude` | numbers | numbers |
| `sequence` | `0` | `1..n` |
| `is_completed` | `false` | `false` |

**There is no `items[]` array.** Load is `weight_kg` + `parcel_count` only. Anything
deriving weight from an item manifest gets nothing from this endpoint.

---

## 3. Assignments (legacy single-mission flow)

| Method | Path | Request | Returns |
| --- | --- | --- | --- |
| GET | `/assignments/` | — | `Assignment[]` |
| POST | `/assignments/{id}/accept/` | — | `Assignment` |
| POST | `/assignments/{id}/pickup/` | `{ handover_code }` | — |
| POST | `/assignments/{id}/transit/` | `{ latitude, longitude }` | — |
| POST | `/assignments/{id}/deliver/` | `{ stop_id, type, otp_code, latitude, longitude, cod_collected }` | — |
| POST | `/assignments/{id}/resend-otp/` | — | — |

```ts
Assignment {
  id, service: "swift"|"next-day"|"standard",
  earnings, distance_km, weight_kg,
  stops: Stop[],
  fee: { weight, distance, premium },
  status: "PENDING"|"ACCEPTED"|"PICKED_UP"|"IN_TRANSIT"|"DELIVERED"
}
```

`deliver/` is used by **both** flows — trip drop-offs call it with the stop's `assignment` id.
`type` accepts only `"otp" | "photo"`; the app sends `"otp"` and uploads the photo separately,
so the backend cannot currently tell that both proofs were captured.
`cod_collected` is **not in the documented contract** — the app sends it, the backend must be
taught to persist it.

> ⚠️ **Inferred from the TypeScript interface — never observed.** Field names, types and
> nullability may all be wrong. Run the API capture (see top) to replace this with real JSON.

```json
// GET /api/delivery-partner/assignments/  → 200
[
  {
    "id": "483840a5-953c-454f-b560-f416a64f42d1",
    "service": "swift",
    "earnings": 126.76,
    "distance_km": 14.46,
    "weight_kg": 8.21,
    "status": "PENDING",
    "fee": { "weight": 41.05, "distance": 72.3, "premium": 13.41 },
    "stops": [
      {
        "id": "322bf49c-f5dc-464d-b4cd-3eaefdd18fb1",
        "type": "dropoff",
        "label": "Current Location",
        "address": "Devarachikkanahalli",
        "customer": "Shailaja Manjunath",
        "eta": "",
        "notes": "",
        "latitude": 12.894016,
        "longitude": 77.615992,
        "sequence": 1,
        "is_completed": false
      }
    ]
  }
]

// POST /assignments/{id}/deliver/   request body the app sends
{
  "stop_id": "322bf49c-…",
  "type": "otp",
  "otp_code": "483921",
  "latitude": 12.894016,
  "longitude": 77.615992,
  "cod_collected": false
}
// → 200, body not verified (the app only checks for an error)
```

Confidence: **declared**.

---

## 4. Status, earnings, proof

| Method | Path | Request | Returns |
| --- | --- | --- | --- |
| PATCH | `/status/` | `{ online, latitude, longitude }` | `{ online }` |
| GET | `/earnings/` | — | `EarningsStats` |
| GET | `/earnings/history/?days=N` | — | `EarningsHistory` |
| POST | `/proof/` | multipart `{ mission_id, photo }` | `{ url }` |

```ts
EarningsStats  { earnings, goal, deliveries, distance, rating }

EarningsHistory {
  period:  { start, end, days }
  summary: { total_earnings, total_deliveries, total_distance }
  daily_breakdown:   { date, earnings, deliveries, distance }[]
  lifetime:          { total_earnings, total_deliveries, rating }
  recent_deliveries: { id, date, earnings, distance, service }[]
}
```

> ⚠️ **Inferred from the TypeScript interface — never observed.** Field names, types and
> nullability may all be wrong. Run the API capture (see top) to replace this with real JSON.

```json
// PATCH /api/delivery-partner/status/   { online, latitude, longitude }
{ "online": true }

// GET /api/delivery-partner/earnings/
{ "earnings": 1284.5, "goal": 1500, "deliveries": 11, "distance": 63.4, "rating": 4.8 }

// GET /api/delivery-partner/earnings/history/?days=30
{
  "period":  { "start": "2026-06-24", "end": "2026-07-24", "days": 30 },
  "summary": { "total_earnings": 38420.0, "total_deliveries": 291, "total_distance": 1847.2 },
  "daily_breakdown": [
    { "date": "2026-07-24", "earnings": 1284.5, "deliveries": 11, "distance": 63.4 }
  ],
  "lifetime": { "total_earnings": 142800.0, "total_deliveries": 1391, "rating": 4.8 },
  "recent_deliveries": [
    { "id": "…", "date": "2026-07-24", "earnings": 126.76, "distance": 14.46, "service": "swift" }
  ]
}

// POST /api/delivery-partner/proof/   multipart { mission_id, photo }
{ "url": "https://api.freshon.in/media/proof/….jpg" }
```

Confidence: **declared**.

---

## 5. Profile & KYC

| Method | Path | Request | Returns |
| --- | --- | --- | --- |
| GET | `/profile/` | — | `DeliveryPartnerProfile` |
| PATCH | `/profile/` | partial profile | `DeliveryPartnerProfile` |
| GET | `/documents/` | — | `{ documents, kyc_status }` |
| POST | `/documents/` | multipart `{ doc_type, doc_number, file }` | `{ documents, kyc_status }` |

```ts
DeliveryPartnerProfile {
  id, username, name, phone,
  vehicle_type: "BIKE"|"SCOOTER"|"CYCLE"|"VAN", vehicle_number,
  address, city, pincode,
  payout_method: ""|"UPI"|"BANK", bank_upi,
  bank_account_name, bank_account_number, bank_ifsc,
  is_online, total_deliveries, total_earnings, rating
}

KycDocument { id, doc_type, doc_type_display, doc_number, file, file_url,
              status: "pending"|"verified"|"rejected", status_display,
              uploaded_at, verified_at, rejection_reason }

KycStatus   { required_count, uploaded_count, is_complete, missing_documents }
```

`doc_type` ∈ `aadhaar | pan | driving_licence | vehicle_rc | insurance`.
The rider can only go online when `is_complete` **and** every document is `verified`.

> ⚠️ **Inferred from the TypeScript interface — never observed.** Field names, types and
> nullability may all be wrong. Run the API capture (see top) to replace this with real JSON.

```json
// GET /api/delivery-partner/profile/
{
  "id": 42, "username": "rider_9900242455", "name": "Shailaja Manjunath",
  "phone": "9900242455",
  "vehicle_type": "BIKE", "vehicle_number": "KA 05 DE 1234",
  "address": "Devarachikkanahalli", "city": "Bengaluru", "pincode": "560076",
  "payout_method": "UPI", "bank_upi": "rider@upi",
  "bank_account_name": "", "bank_account_number": "", "bank_ifsc": "",
  "is_online": true, "total_deliveries": 1391, "total_earnings": 142800.0, "rating": 4.8
}

// GET /api/delivery-partner/documents/
{
  "documents": [
    {
      "id": "…", "doc_type": "aadhaar", "doc_type_display": "Aadhaar",
      "doc_number": "XXXX-XXXX-1234",
      "file": "kyc/aadhaar_42.jpg",
      "file_url": "https://api.freshon.in/media/kyc/aadhaar_42.jpg",
      "status": "verified", "status_display": "Verified",
      "uploaded_at": "2026-01-04T09:00:00Z",
      "verified_at": "2026-01-05T11:30:00Z",
      "rejection_reason": ""
    }
  ],
  "kyc_status": {
    "required_count": 5, "uploaded_count": 5,
    "is_complete": true, "missing_documents": []
  }
}
```

Confidence: **declared**.

---

## 6. Wallet

| Method | Path | Request | Returns |
| --- | --- | --- | --- |
| GET | `/wallet/` | — | `WalletSummary` |
| POST | `/wallet/withdraw/` | `{ amount, method }` | `Withdrawal` |
| GET | `/wallet/withdrawals/` | — | `Withdrawal[]` |

```ts
WalletSummary { available, pending, total_earned, total_withdrawn,   // decimal strings
                hold_hours, next_matures_at, transactions[] }

Withdrawal    { id, amount, method: "UPI"|"BANK",
                status: "PENDING"|"PROCESSING"|"PAID"|"REJECTED"|"CANCELLED",
                reference, note, upi_id, bank_*, processed_by,
                requested_at, processed_at }
```

> ⚠️ **Inferred from the TypeScript interface — never observed.** Field names, types and
> nullability may all be wrong. Run the API capture (see top) to replace this with real JSON.

```json
// GET /api/delivery-partner/wallet/
{
  "available": "1840.00", "pending": "460.00",
  "total_earned": "142800.00", "total_withdrawn": "140500.00",
  "hold_hours": 24, "next_matures_at": "2026-07-25T06:00:00Z",
  "transactions": [
    {
      "id": "…", "type": "CREDIT", "reason": "delivery",
      "amount": "126.76", "description": "Trip c2fcc60c",
      "matures_at": "2026-07-25T06:00:00Z", "created_at": "2026-07-24T06:00:00Z"
    }
  ]
}

// GET /api/delivery-partner/wallet/withdrawals/
[
  {
    "id": "…", "amount": "1500.00", "method": "UPI", "status": "PAID",
    "reference": "UTR123456", "note": "", "upi_id": "rider@upi",
    "bank_account_name": "", "bank_account_number": "", "bank_ifsc": "",
    "processed_by": "ops_admin",
    "requested_at": "2026-07-20T10:00:00Z", "processed_at": "2026-07-21T08:12:00Z"
  }
]
```

Confidence: **declared**. Note the money fields are **strings**, like `total_distance_km`.

---

## 7. Cash drop (COD reconciliation) — defined but unused

| Method | Path | Request | Returns |
| --- | --- | --- | --- |
| POST | `/cash/drop/` | `{ amount }` | `CashDrop` |
| GET | `/cash/drop/{id}/status/` | — | `CashDrop` |

`src/lib/cashDropService.ts` exists but **no UI references it**. Dead code today.

---

## 8. WebSocket

`wss://api.freshon.in/ws/delivery/driver/?token=<device_auth_key>` (`VITE_WS_URL`)

**Client → server**

| Message | Payload |
| --- | --- |
| `location_update` | `{ lat, lng }` — every 30s while connected |
| `claim_trip` | `{ trip_id }` |
| `cancel_trip` | `{ trip_id }` |
| `ping` | — every 25s |

**Server → client**

| Event | Payload |
| --- | --- |
| `trip_available` | `{ trip: DeliveryTrip, in_range: boolean }` |
| `trip_released` | `{ trip, in_range }` — reassignment, same handling |
| `trip_claimed` | `{ trip_id }` — someone else took it |
| `claim_result` | `{ success, trip?, error? }` |
| `pong` | — |

Auto-reconnects with capped exponential backoff (max 30s). Claims time out at 10s.

---

## 9. Third-party (not FreshOn)

| Service | Used for |
| --- | --- |
| `router.project-osrm.org` | Road route geometry for the map, and rider→hub distance. Public demo server, no key, no SLA. |
| `api.freshon.in/ota` | OTA bundle updates (`vendor/freshon-api/dist/ota`). |

---

## Gotchas

1. **`total_distance_km` is a decimal string** (`"14.46"`). Calling `.toFixed()` on it throws.
   Read it through `tripKm(trip)` from `deliveryTripService`. Wallet amounts are strings too.
2. **No `items[]` on trip stops.** Use `weight_kg` and `parcel_count`.
3. **Addresses contain newlines.** Render with `whitespace-pre-line`, not `truncate`.
4. **`stop_count` excludes the hub**, but `stops[]` includes it — a 1-drop trip has
   `stop_count: 1` and `stops.length === 2`.
5. **`customer_phone` is `""` on hub stops**, not null. Treat empty as absent.
6. **No public API schema** — `/api/schema/`, `/api/docs/`, `/swagger/`, `/redoc/` all 404,
   and `OPTIONS` is auth-gated. Response shapes can only be observed from a signed-in
   session; the dev bar's payload probe exists for exactly that.
