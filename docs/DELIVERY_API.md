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

The app sends more than this table lists: `cod_collected`, `cod_amount`, `photo_captured`,
`proof_url`, `exception_reason` and `accuracy_m` all cross the wire today and are all
dropped server-side. Each is the client half of a fix — see **§ 7a Required server
changes** (S1, S3, S5, S8) for what each is for and why it matters.

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

`/proof/` is also sent `stop_id`, `captured_at`, `latitude`, `longitude`, `accuracy_m` and
`capture_id` — provenance for the photo and an idempotency key for its retries, none of
which the endpoint reads yet. See **§ 7a**, S4. The photo itself is downscaled to a
1280 px long edge and encoded at quality 0.72 before upload (~150–250 KB, down from
several MB), and carries a burned-in timestamp and coordinate stamp.

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

`src/lib/cashDropService.ts` exists but **no UI references it**. Dead code today, and it
cannot stop being dead code until the rider's outstanding cash balance is exposed —
see § "Required server changes", S6.

---

## 7a. Required server changes

Everything below is **already sent or already relied on by the app**. Each one is the
server half of a fix whose client half has shipped: the field crosses the wire today and
is ignored. Ordered by consequence.

Fields the app now sends that no endpoint reads yet:

| Endpoint | New field | Type | Purpose |
| --- | --- | --- | --- |
| `deliver/` | `cod_amount` | number | how much cash was actually taken |
| `deliver/` | `photo_captured` | bool | a doorstep photo exists for this stop |
| `deliver/` | `proof_url` | string | the stored photo, linked to the delivery |
| `deliver/` | `exception_reason` | enum\|null | `OTP_UNAVAILABLE` — closed without a code |
| `deliver/` | `accuracy_m` | number | error radius of the rider's fix |
| `/proof/` | `stop_id` | uuid | which door this photo is of |
| `/proof/` | `captured_at` | ISO-8601 | when the shutter fired, not when it uploaded |
| `/proof/` | `latitude`/`longitude`/`accuracy_m` | number | where it was taken |
| `/proof/` | `capture_id` | string | idempotency key, stable across retries |

---

### S1 — `deliver/` must persist `cod_collected` and `cod_amount`

**Change.** Store both against the delivery. `cod_collected` has been arriving for a
while and is dropped; `cod_amount` is new.

**Why.** This is a cash-handling hole, not a cosmetic one. A rider takes cash at the
door, ticks the box, and nothing in the system records that they are now holding the
customer's money. Nothing can be reconciled against a cash drop, no shortfall is ever
detectable, and a dispute has no record on either side. A boolean alone would not fix it
— "cash was taken" cannot be balanced against anything. The amount can.

---

### S2 — Stop payloads must carry `cod_amount`

**Change.** Add `cod_amount` to the drop-off stop object on `/trips/active/`,
`/trips/available/` and `/assignments/`. Three states, and they must be distinct:

- a positive decimal → COD, this much is due
- `null` → prepaid, nothing to collect
- **field absent** → the app assumes this change hasn't shipped and falls back

**Why.** The app has never known which orders are COD, so it showed "Cash on delivery
collected" at *every* door — inviting a tick on prepaid orders — while giving the rider
on a genuine COD order no idea how much to ask for. The client already handles all three
states (`src/lib/cod.ts`); until the field appears it stays on the legacy tick.

---

### S3 — `deliver/` must return a stable `error_code`

**Change.** Alongside the human-readable `error`, return a machine-readable code:

```json
{ "error": "You are too far from the delivery address", "error_code": "OUTSIDE_GEOFENCE" }
```

Suggested set: `INVALID_OTP`, `OTP_EXPIRED`, `OUTSIDE_GEOFENCE`, `ALREADY_DELIVERED`,
`NOT_IN_TRANSIT`, `LOCATION_REQUIRED`.

**Why.** These call for opposite responses from the rider — re-enter the code, walk
closer, refresh the trip — and today they are indistinguishable prose. The app currently
**pattern-matches the English message** (`src/lib/deliveryErrors.ts`) to decide whether
to clear the OTP boxes. That works and it is a stopgap: it breaks the moment the wording
changes or the API is localised.

---

### S4 — `/proof/` must accept provenance, and be idempotent

**Change.** Accept and store `stop_id`, `captured_at`, `latitude`, `longitude`,
`accuracy_m`, `capture_id`. Treat `capture_id` as an idempotency key: a repeat upload
with a key already seen returns the existing row instead of creating a second.

**Why, provenance.** A canvas capture carries no EXIF whatsoever — no timestamp, no GPS,
no device. A proof photo with no when and no where settles no dispute; a rider could
photograph a parcel in the van a kilometre from the address. The app now stamps both into
the pixels *and* sends them as fields.

**Why, idempotency.** The upload retries transient failures (a lift lobby eating one
request used to fail an otherwise-complete delivery). A retry after a lost response would
otherwise store the same doorstep twice.

**Also.** Link the proof to the delivery. Today `/proof/` and `deliver/` are unrelated
writes joined only by `mission_id` — with `stop_id` and `proof_url` (S1) the row can
finally be attached to the stop it evidences.

---

### S5 — `deliver/` must record the no-code exception, and flag it

**Change.** Accept `exception_reason: "OTP_UNAVAILABLE"` on a `type: "photo"` delivery,
store it, and surface those deliveries in whatever operations queue reviews exceptions.

**Why.** Until now a rider whose customer could not receive the code had **no way to
complete the delivery at all** — phone off, wrong number on file, SMS never arrived. The
parcel is handed over in the real world and the app cannot record it. The options left
were abandoning the stop or faking something. The app now offers a photo-only path after
two failed attempts, and it must be visibly distinct from a normal delivery — otherwise
it becomes the easy route rather than the last one.

---

### S6 — Expose the rider's outstanding cash balance

**Change.** Add the rider's uncollected COD total to `/wallet/` (or a dedicated
`/cash/outstanding/`), and return it in the same shape as the wallet's other money
fields.

**Why.** `/cash/drop/` exists and `cashDropService.ts` implements it, but no UI can be
built on top: the app has no way to show the rider how much cash they are holding or how
much to hand in. Without S1 there is nothing to total, and without this endpoint there is
nothing to display. Together they close the cash loop: collected at the door (S1) →
totalled here → dropped at the hub (`/cash/drop/`).

---

### S7 — Rate-limit `resend-otp/`, and say so in the response

**Change.** Enforce a server-side cooldown and cap. Return the state rather than a bare
200:

```json
{ "sent": true, "cooldown_seconds": 45, "resends_remaining": 2 }
```

**Why.** The app now enforces a 45-second client-side cooldown, which is a courtesy, not
a control — it is trivially bypassed by reloading. The cost of not having a real limit is
the SMS bill and a gateway that starts refusing the send that would have worked. The
returned values also let the app show the true remaining wait instead of guessing.

---

### S8 — Distinguish "both proofs captured" from "one proof captured"

**Change.** Accept `photo_captured` (S1) and, ideally, widen `type` to include a value
meaning both — e.g. `"otp_photo"`.

**Why.** The UI enforces a two-step chain: photo, then OTP, both mandatory. The API's
`type` field names exactly one proof, so the app sends `"otp"` and uploads the photo
separately. The backend therefore **cannot verify that the policy it is relying on was
followed** — every delivery looks like an OTP-only delivery.

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
