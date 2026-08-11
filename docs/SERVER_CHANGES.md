# Server-side changes required by the FreshOn rider app

**Audience:** whoever is working on the FreshOn backend (the Django/DRF service behind
`https://api.freshon.in`). This document is self-contained — you should not need the rider
app's source to act on it.

**Status of the client:** every field described below is **already being sent by the
shipped rider app**. Each change here is the server half of a fix whose client half is
done. Until you make these changes the fields cross the wire and are silently dropped, and
the behaviours they enable stay broken.

**How to read the priorities:** S1, S2 and S6 together close a live cash-handling hole and
are the reason this document exists. S3 and S7 are correctness and abuse-control. S4, S5,
S8, S10 are evidence integrity. S9 is login abuse-control.

---

## 0. Ground rules

### 0.1 Backward compatibility is mandatory

Riders run whatever build is on their phone. Old versions will be in the field for weeks
after you deploy.

- **Every new request field must be optional.** An old client omits all of them; that
  request must keep working exactly as it does today.
- **Every new response field must be additive.** Never remove or repurpose an existing
  key. Old clients ignore unknown keys — they will not ignore a key that changed meaning.
- **Never tighten an existing validation** as part of this work. If a new rule would
  reject what an old client sends, gate the rule on the new field being present.

Concretely: `deliver/` must still succeed for a request body of exactly
`{stop_id, type, otp_code, latitude, longitude}`.

### 0.2 Do not trust the client

Several new fields are client-asserted (`cod_amount`, `captured_at`, `latitude`,
`photo_captured`). They are useful, and they are also exactly what a rider would
manipulate to close a stop they are not at. Each section below says what to validate
against server-side truth. **Where the client's value and the server's disagree, the
server's wins and the discrepancy is recorded.**

### 0.3 Authentication, unchanged

All `/api/delivery-partner/*` routes take `Authorization: Bearer <device_auth_key>` (a
90-day opaque key, not a JWT) plus `X-App-Platform: DeliveryApp`. None of that changes.

---

## 1. There are two different OTPs — do not conflate them

This is the single most likely source of a wrong fix here. They share nothing: not the
endpoint, not the recipient, not the storage, not the lifetime.

| | **Rider login OTP** | **Customer handover OTP** |
| --- | --- | --- |
| Endpoint | `POST /api/auth/send-otp/` → `POST /api/auth/verify-otp/` | `POST /api/delivery-partner/assignments/{id}/resend-otp/` → verified inside `deliver/` |
| Sent to | the **rider's** phone | the **customer's** phone |
| Purpose | signs the rider into the app | proves the customer received the parcel |
| Authentication | none (this is how you log in) | rider's Bearer key |
| Scope | a phone number | one assignment / stop |
| Issued when | rider taps Continue on the login screen | at pickup, automatically |
| Verified by | `verify-otp/`, returns a device key | `deliver/`, with `type: "otp"` and `otp_code` |
| Who types it in | the rider, reading their own SMS | the rider, reading it aloud from the customer |
| Covered by | **S9** | **S7** |

`resend-otp/` under `/assignments/{id}/` is the **customer's** code. It resends the
handover code for that delivery. It has nothing to do with logging in.

Note the asymmetry that follows from "who types it in": the rider's own login code may be
SMS-autofilled by the phone (and the app sets `autocomplete="one-time-code"` for it). The
customer's handover code must **never** be autofillable on the rider's device — the app
deliberately does not set that attribute there. Do not "helpfully" add it.

---

## 2. Field reference — everything the client now sends

Quick lookup. Details and validation rules are in the per-change sections.

### `POST /api/delivery-partner/assignments/{id}/deliver/` (JSON)

| Field | Type | Status | Notes |
| --- | --- | --- | --- |
| `stop_id` | uuid | existing | |
| `type` | `"otp"` \| `"photo"` | existing | `"photo"` now means the exception path |
| `otp_code` | string(6) | existing | absent on the exception path |
| `latitude` / `longitude` | float | existing | may be absent if the stop has no coords |
| `cod_collected` | bool | **sent, dropped** | always present, explicitly `false` |
| `cod_amount` | number | **new** | present only when the stop declared an amount |
| `photo_captured` | bool | **new** | |
| `proof_url` | string | **new** | the URL `/proof/` returned |
| `exception_reason` | `"OTP_UNAVAILABLE"` | **new** | present only on the exception path |
| `accuracy_m` | number | **new** | GPS error radius in metres |

### `POST /api/delivery-partner/proof/` (multipart)

| Field | Type | Status |
| --- | --- | --- |
| `mission_id` | uuid | existing |
| `photo` | file (JPEG) | existing |
| `capture_id` | string | **new** — idempotency key |
| `stop_id` | uuid | **new** |
| `captured_at` | ISO-8601 | **new** |
| `latitude` / `longitude` | float | **new** |
| `accuracy_m` | float | **new** |

---

## S1 — `deliver/` must persist `cod_collected` and `cod_amount`

**Priority: highest. This is a live cash-handling hole.**

### Current behaviour

`cod_collected` arrives on every delivery and is discarded. `cod_amount` is new.

### Why this matters

A rider takes cash at the door and ticks a box. Nothing in the system records that they
are now holding the customer's money. There is no figure to reconcile against a cash drop,
no way to detect a shortfall, and nothing on either side of a dispute. A boolean alone
would not fix it: "cash was taken" balances against nothing. The amount does.

### Required

Persist both against the delivery record:

```
delivery.cod_collected  = bool     # rider asserts cash changed hands
delivery.cod_amount     = Decimal  # what the rider says they took
delivery.cod_expected   = Decimal  # what the order actually says is due (server truth)
```

Then create the ledger entry that makes reconciliation possible — the rider's outstanding
cash balance increases by `cod_expected` (**not** by the client's `cod_amount`), in the
same transaction as the delivery.

### Validation and edge cases

| Case | Required behaviour |
| --- | --- |
| Order is prepaid, `cod_collected: true` | Reject, `400`, `error_code: "COD_NOT_DUE"`. Nothing was owed; something is wrong. |
| Order has COD due, `cod_collected: false`, no `exception_reason` | Reject, `400`, `error_code: "COD_NOT_COLLECTED"`. The parcel must not leave without the cash. |
| Order has COD due, `cod_collected: false`, **with** `exception_reason` | Accept, flag for review. Handled separately from a normal delivery. |
| `cod_amount` ≠ `cod_expected` | Reject, `400`, `error_code: "COD_AMOUNT_MISMATCH"`, and include `expected_amount` in the response. Silently accepting the wrong figure defeats the entire point. |
| `cod_amount` absent, order has COD due | Accept (old client) — record `cod_expected` and flag the delivery as `cod_amount_unverified`. Do **not** reject; old clients cannot send it. |
| `cod_amount` present, order is prepaid | Reject, `400`, `COD_NOT_DUE`. |
| `cod_amount` ≤ 0 or non-numeric | Reject, `400`, validation error. |
| Repeated delivery of the same stop | See **S10**. Must not double-credit the cash ledger. |

Use `Decimal` throughout. Never float for money.

### Acceptance tests

1. COD order, correct amount, `cod_collected: true` → `200`, rider's outstanding balance
   increases by exactly the order's COD due.
2. Same request sent twice → balance increases **once**.
3. COD order with `cod_amount` 100 less than due → `400 COD_AMOUNT_MISMATCH`.
4. Prepaid order with `cod_collected: true` → `400 COD_NOT_DUE`.
5. Old-client body (no `cod_amount`) on a COD order → `200`, delivery flagged unverified.
6. Old-client body on a prepaid order → `200`, unchanged from today.

---

## S2 — Stop payloads must carry `cod_amount`

### Current behaviour

No payment information reaches the rider at all. The app therefore showed a "Cash on
delivery collected" tick at **every** door — inviting a tick on prepaid orders — while
telling a rider on a genuine COD order nothing about how much to ask for.

### Required

Add `cod_amount` to every **drop-off** stop object returned by:

- `GET /api/delivery-partner/trips/active/`
- `GET /api/delivery-partner/trips/available/`
- `GET /api/delivery-partner/assignments/`

Three states, and they are **not** interchangeable:

| Value | Meaning | What the app does |
| --- | --- | --- |
| `"640.00"` (positive) | COD, this much is due | Shows "Collect ₹640", blocks completion until confirmed |
| `null` | prepaid, nothing to collect | Shows "Prepaid — no cash to collect", no tick at all |
| **key absent** | this change has not shipped | Falls back to the legacy free-standing tick |

**The distinction between `null` and absent is load-bearing.** Once you ship this, always
include the key on drop-off stops — send `null`, never omit. Omitting it tells the app the
backend does not support the field and it reverts to the old behaviour.

Hub `pickup` stops do not need the field.

### Format

Send a **decimal string** (`"640.00"`), consistent with the wallet endpoints, which
already send money as strings. The app parses both string and number, so either works —
string is preferred for consistency.

### Edge cases

- **Partially prepaid orders.** Send the outstanding balance only, not the order total.
- **COD amount changed after dispatch.** The value at read time is what the rider is shown
  and what they will send back; S1's mismatch check compares against the value at delivery
  time. If these can diverge, prefer rejecting with `COD_AMOUNT_MISMATCH` and letting the
  rider re-open the stop to see the new figure.
- **Currency.** Rupees, matching everything else. Do not introduce a currency field.

---

## S3 — `deliver/` must return a machine-readable `error_code`

### Current behaviour

Failures come back as human prose in `error`. A wrong OTP, a geofence rejection and a
lifecycle error are indistinguishable to the client.

### Why this matters

These demand **opposite** responses from the rider — re-enter the code, walk closer,
refresh the trip. The app currently pattern-matches the English message to decide whether
to clear the OTP boxes (`src/lib/deliveryErrors.ts`). That works today and breaks the
moment anyone rewords a message or the API is localised. It is a stopgap for exactly this
change.

### Required

Keep `error` exactly as it is (old clients show it). **Add** `error_code`:

```json
{
  "error": "You are too far from the delivery address",
  "error_code": "OUTSIDE_GEOFENCE",
  "distance_m": 1240
}
```

### Codes

| `error_code` | HTTP | When |
| --- | --- | --- |
| `INVALID_OTP` | 400 | code does not match |
| `OTP_EXPIRED` | 400 | code aged out |
| `OTP_ATTEMPTS_EXCEEDED` | 429 | too many wrong codes for this stop |
| `OUTSIDE_GEOFENCE` | 400 | rider too far from the drop; include `distance_m` |
| `LOCATION_REQUIRED` | 400 | no coordinates supplied and the stop is geofenced |
| `ALREADY_DELIVERED` | 409 | see S10 — usually should not be reached |
| `NOT_IN_TRANSIT` | 409 | assignment is in the wrong state |
| `COD_NOT_DUE` / `COD_NOT_COLLECTED` / `COD_AMOUNT_MISMATCH` | 400 | see S1 |
| `PROOF_REQUIRED` | 400 | see S8 |

Apply the same `error_code` convention to `pickup/`, `transit/` and `resend-otp/` while
you are in there. It costs little and the client already has the plumbing.

---

## S4 — `/proof/` must accept provenance, and be idempotent

### Current behaviour

Accepts `mission_id` and `photo`. Returns `{url}`.

### Why provenance matters

The app captures the photo from a live camera stream onto a canvas, which **strips EXIF
entirely** — no timestamp, no GPS, no device. A proof photo with no *when* and no *where*
settles no dispute; a rider could photograph a parcel in the van a kilometre from the
address. The app now stamps both into the pixels and sends them as fields.

### Why idempotency matters

The client **retries** transient upload failures (a lift lobby eating one request used to
fail an otherwise-complete delivery). A retry after a lost response would otherwise store
the same doorstep twice, with no way to tell which row the delivery refers to.

### Required

Accept and persist these additional multipart fields, all optional:

| Field | Type | Notes |
| --- | --- | --- |
| `capture_id` | string ≤ 128 | idempotency key, stable across retries of one capture |
| `stop_id` | uuid | which drop-off this evidences |
| `captured_at` | ISO-8601 | client clock — store, do not trust |
| `latitude` / `longitude` | float | client fix |
| `accuracy_m` | float | error radius in metres |

Also store `received_at` from the **server** clock, always.

**Idempotency:** unique together on `(rider, capture_id)`. On a repeat, return `200` with
the **existing** row's URL — not `409`, not a new row. The client treats a non-2xx as a
failed upload and will block the delivery.

**Response** — extend additively:

```json
{ "url": "https://cdn.freshon.in/proof/abc.jpg", "id": "uuid", "duplicate": false }
```

### Validation and edge cases

| Case | Required behaviour |
| --- | --- |
| `capture_id` absent (old client) | Accept, store a new row. No dedup possible — that is fine. |
| Same `capture_id`, **different** rider | Treat as distinct. The key is only unique per rider. |
| Same `capture_id`, different photo bytes | Return the existing row. Do not overwrite; the first upload is the evidence. |
| `captured_at` far from `received_at` | Store both. Flag if the skew exceeds ~24 h — a wrong device clock is common and is not itself fraud. **Never reject on skew**; a rider with a bad clock cannot fix it at the door. |
| `captured_at` in the future | Same — store, flag, do not reject. |
| Latitude/longitude out of range | Reject the *field*, not the request: store the photo without coordinates. Losing the photo is worse than losing the fix. |
| `stop_id` not on the given `mission_id` | Reject, `400`. This one is a genuine inconsistency. |
| Photo larger than the limit | Keep the current limit generous (≥ 10 MB). New clients send ~150–250 KB; **old clients still send multi-megabyte files** and must keep working. |
| Non-image upload | Reject, `400`, validate content type and magic bytes. |

### Also: link the proof to the delivery

Today `/proof/` and `deliver/` are unrelated writes joined only by `mission_id`. With
`stop_id` here and `proof_url` from S1, attach the proof row to the stop it evidences.

---

## S5 — Record and flag the no-code exception

### Current behaviour

A `type: "photo"` delivery is indistinguishable from any other.

### Why this matters

Until now, a rider whose customer could not receive the code had **no way to complete the
delivery at all** — phone off, wrong number on file, SMS never arrived. The parcel is
handed over in the real world and the app cannot record it. The rider's only options were
abandoning the stop or faking something.

The app now offers a photo-only path, **withheld until two failed code attempts or one
resend**, behind a second confirmation. It must be visibly distinct from a normal delivery
or it becomes the easy route rather than the last one.

### Required

- Accept `exception_reason` on `deliver/`. Currently one value, `"OTP_UNAVAILABLE"` —
  model it as an extensible enum, more will follow (`CUSTOMER_ABSENT`, `ADDRESS_WRONG`).
- Store it on the delivery and mark the delivery as requiring review.
- Surface these in whatever queue operations already uses. If none exists, a filterable
  flag plus a daily digest is enough to start.

### Validation and edge cases

| Case | Required behaviour |
| --- | --- |
| `exception_reason` present with `type: "otp"` | Reject, `400`. Contradictory: a code was used. |
| `exception_reason` present, no proof photo for the stop | Reject, `400`, `PROOF_REQUIRED`. The photo is the *only* evidence on this path. |
| `type: "photo"` with **no** `exception_reason` (old client) | Accept, as today. Do not retroactively flag old clients' deliveries. |
| Unknown `exception_reason` value | Reject, `400`. Do not store free text. |
| **Geofence on the exception path** | **Still enforced.** The exception is about the customer's phone, not about where the rider is. Do not let it bypass the location check. |
| COD on the exception path | Cash still reconciles per S1. Flag prominently: cash taken with no customer confirmation is the highest-risk combination in the system. |

### Rate

Track exceptions per rider. A rider whose exception rate is materially above their peers'
is the signal this flag exists to produce.

---

## S6 — Expose the rider's outstanding cash balance

### Current behaviour

`POST /api/delivery-partner/cash/drop/` and `GET /cash/drop/{id}/status/` both exist and
are implemented client-side in `cashDropService.ts` — **but no screen can use them.** The
app has no way to show a rider how much cash they hold or how much to hand in, so there is
nothing to build a cash-drop UI around.

### Required

Add the rider's uncollected COD total, either to the existing `GET /wallet/` response or
as a dedicated endpoint:

```json
// GET /api/delivery-partner/cash/outstanding/
{
  "outstanding": "2340.00",
  "collected_total": "5840.00",
  "dropped_total": "3500.00",
  "last_drop_at": "2026-08-11T14:20:00Z",
  "deliveries": [
    { "order_id": "FRSH-2FC946", "amount": "640.00", "delivered_at": "2026-08-11T09:15:00Z" }
  ]
}
```

Definition: `outstanding = Σ(cod collected, per S1) − Σ(cash drops acknowledged)`.

Only count deliveries where `cod_collected` is true **and** the delivery is not reversed.
Amounts as decimal strings, consistent with the wallet.

### Why

This is what unblocks the cash-drop UI and closes the loop:
**collected at the door (S1) → totalled here (S6) → dropped at the hub (`/cash/drop/`)**.
Without S1 there is nothing to total; without S6 there is nothing to display. Neither
endpoint is useful alone.

### Edge cases

- A drop in `PENDING` (not yet acknowledged by the hub) must **not** reduce `outstanding`.
  A rejected or expired drop must not either.
- A reversed or cancelled delivery must reduce `collected_total`.

---

## S7 — Rate-limit `resend-otp/` (the customer's code) and report the limit

### Current behaviour

No limit, and the response is a bare `200`.

### Why this matters

The app now enforces a 45-second cooldown per stop. **That is a courtesy, not a control** —
it lives in memory and dies with a reload. The real cost of no server limit is your SMS
bill and a gateway that starts refusing the send that would actually have worked.

### Required

Enforce a cooldown and a cap, per assignment **and** per rider **and** per destination
phone number (a rider cycling between stops must not bypass a per-stop limit).

Suggested: 45 s between sends, 5 sends per assignment, 20 per rider per hour.

**Response** — extend additively:

```json
{ "sent": true, "cooldown_seconds": 45, "resends_remaining": 3 }
```

On refusal, `429` with `Retry-After` and:

```json
{ "error": "Too many resend attempts. Wait 30 seconds.",
  "error_code": "RESEND_COOLDOWN", "cooldown_seconds": 30, "resends_remaining": 0 }
```

### OTP lifecycle — please pin these down explicitly

These are currently undocumented and the app has to guess:

| Question | Recommendation |
| --- | --- |
| Does a resend invalidate the previous code? | **Yes.** One active code per stop. Two valid codes doubles the guessing surface and confuses a customer reading out the older SMS. |
| Expiry | 15–30 minutes. Long enough for a slow stairwell, short enough to matter. |
| Wrong-code attempts before lockout | 5 per stop, then `OTP_ATTEMPTS_EXCEEDED` (429). The app surfaces this and offers the S5 exception path. |
| Storage | Hashed, not plaintext. Compare in constant time. |
| Single use | Yes — a code that completed a delivery must not verify again. |

---

## S8 — Distinguish "both proofs captured" from "one"

### Current behaviour

`type` names exactly one proof. The app enforces a **two-step chain** — photo, then OTP,
both mandatory for every drop-off — but has to send `type: "otp"` and upload the photo
separately. The backend therefore **cannot verify that the policy it relies on was
followed.** Every delivery looks OTP-only.

### Required

- Accept `photo_captured: bool` on `deliver/` and store it.
- When `photo_captured` is true, verify a proof row actually exists for that stop
  (via S4's `stop_id`). If not, reject with `PROOF_REQUIRED` — the claim is false.
- Optionally widen `type` to accept `"otp_photo"`. If you do, **keep accepting `"otp"` and
  `"photo"` unchanged** — old clients only send those.

Once shipped, "was proof of delivery actually captured?" becomes an answerable question
for the first time.

---

## S9 — Rate-limit the rider **login** OTP

This one is about `/api/auth/send-otp/` — the rider's own code. Separate system from S7;
see §1.

### Current behaviour

No limit. Until this release the app had **no resend button at all**, so a rider whose SMS
never arrived had to tap "Change number", retype the same number and submit again — which
sent a second code with nothing between them. The app now has a proper resend with a
30-second client cooldown, which is again only a courtesy.

### Required

- Cooldown and cap per phone number **and** per IP. Suggested: 30 s between sends, 5 per
  phone per hour, 20 per IP per hour.
- Extend the response additively:
  `{ "phone": "+91…", "message": "OTP sent", "cooldown_seconds": 30, "resends_remaining": 4 }`
- `429` + `Retry-After` on refusal.
- Same lifecycle rules as S7: resend invalidates the previous code, hashed storage,
  constant-time compare, single use, capped verify attempts.

### Enumeration

`send-otp/` is unauthenticated. Return the **same** response shape and timing whether or
not the number belongs to a registered rider — otherwise the endpoint is a free
"is this number a FreshOn rider?" oracle. Rate-limit by IP regardless of phone validity.

---

## S10 — Make `deliver/` idempotent

### Current behaviour

A second `deliver/` for an already-delivered stop returns an error
("This stop is already delivered").

### Why this matters

If the response to the first call is lost — a dropped connection at the exact wrong
moment, which is the normal case in a stairwell — the delivery **has** been recorded but
the rider sees a failure. Tapping again then produces a hard error on a stop that is
actually complete, and the rider is stuck: the app shows it as failed, the backend shows
it as done.

### Required

If the same rider re-delivers the same stop with a matching proof, return `200` with the
original result rather than an error. Treat it as "this already happened, here is what
happened", not as a conflict.

Reserve the `ALREADY_DELIVERED` / `409` case for a genuinely different actor or a
materially different payload (different OTP, different exception reason).

**Critically:** the cash ledger entry from S1 must be created **once**. Idempotency here
is what stops a retry from double-crediting a rider's outstanding balance.

---

## 3. Suggested rollout order

Each step is independently deployable and safe on its own.

| # | Change | Unblocks |
| --- | --- | --- |
| 1 | **S3** error codes | Retires the client's English pattern-matching. Zero risk, additive. |
| 2 | **S10** idempotent deliver | Fixes a live "stuck rider" case. |
| 3 | **S4** proof provenance + idempotency | Makes the client's upload retries safe. |
| 4 | **S1** COD persistence + ledger | Closes the cash hole. |
| 5 | **S2** `cod_amount` on stops | Turns on the correct COD UI. **Deploy after S1** — the app will start sending amounts as soon as it sees this field. |
| 6 | **S6** outstanding balance | Unblocks the cash-drop screen. |
| 7 | **S7** + **S9** rate limits | Abuse control. |
| 8 | **S5** exception flagging, **S8** proof verification | Evidence integrity. |

**S2 must not ship before S1.** Shipping S2 alone means riders start confirming exact
amounts that the server then throws away — worse than today, because the rider now
believes the figure was recorded.

---

## 4. What must NOT change

- `deliver/` must keep accepting `{stop_id, type, otp_code, latitude, longitude}` with no
  new fields, and behave as it does today.
- `/proof/` must keep accepting `{mission_id, photo}` alone.
- `type` must keep accepting `"otp"` and `"photo"`.
- Existing `error` strings should stay stable until `error_code` (S3) is deployed and the
  client's fallback matcher is removed — the app currently reads them.
- The 300 m delivery geofence stays. The app added its own 400 m gate in front of it as a
  courtesy, so riders stop discovering the refusal *after* taking a photo and asking for a
  code. It is not a replacement.
- Do not add `autocomplete="one-time-code"` semantics to the customer handover code — see §1.

---

## 5. Verification

A Bruno collection covering every endpoint lives in `bruno/` in the app repo. The relevant
requests are `15`–`18` (assignment pickup / transit / deliver / resend-otp), `21` (upload
proof) and `30`–`31` (cash drop). Point `baseUrl` at your environment and set `deviceKey`
from request `2`.

Per-change acceptance tests are listed inline above; S1 has the fullest set and is the one
worth writing first.

### End-to-end check once S1–S6 are in

1. Dispatch a trip with one COD drop (₹640) and one prepaid drop.
2. Rider app shows "Collect ₹640" on the first and "Prepaid" on the second.
3. Complete the COD stop → outstanding balance reads ₹640.
4. Replay the same `deliver/` request → still ₹640, not ₹1280.
5. Complete the prepaid stop → balance unchanged.
6. Create a cash drop for ₹640, acknowledge it at the hub → outstanding reads ₹0.
