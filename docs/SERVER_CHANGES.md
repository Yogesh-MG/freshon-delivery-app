# Server-side changes required by the FreshOn rider app

**Audience:** whoever is working on the FreshOn backend (the Django/DRF service behind
`https://api.freshon.in`). This document is self-contained — you should not need the rider
app's source to act on it.

**Status of the client:** every field described below is **already being sent by the
shipped rider app**. Each change here is the server half of a fix whose client half is
done. Until you make these changes the fields cross the wire and are silently dropped, and
the behaviours they enable stay broken.

**How to read the priorities:** S1 and S7 fix cases where a rider is left stuck or
misinformed by a response they cannot act on — start there. S2, S3 and S5 are evidence
integrity: whether a delivery's proof can be trusted after the fact. S4 and S6 are
abuse-control on the two OTP endpoints.

**On cash on delivery:** an earlier draft of this document asked for COD persistence, a
`cod_amount` on stop payloads, and a rider cash balance to reconcile against. **Those are
withdrawn.** The rider app no longer collects cash — it sends no COD fields at all, so
there is nothing for the server to record. If COD returns to the app, that work returns
with it; do not build it speculatively.

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

Several new fields are client-asserted (`captured_at`, `latitude`, `accuracy_m`,
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
| Covered by | **S6** | **S4** |

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

## S1 — `deliver/` must return a machine-readable `error_code`

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
| `ALREADY_DELIVERED` | 409 | see S7 — usually should not be reached |
| `NOT_IN_TRANSIT` | 409 | assignment is in the wrong state |
| `PROOF_REQUIRED` | 400 | see S5 |

Apply the same `error_code` convention to `pickup/`, `transit/` and `resend-otp/` while
you are in there. It costs little and the client already has the plumbing.

---

## S2 — `/proof/` must accept provenance, and be idempotent

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
`stop_id` here and `proof_url` from S5, attach the proof row to the stop it evidences.

---

## S3 — Record and flag the no-code exception

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

### Rate

Track exceptions per rider. A rider whose exception rate is materially above their peers'
is the signal this flag exists to produce.

---

## S4 — Rate-limit `resend-otp/` (the customer's code) and report the limit

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
| Wrong-code attempts before lockout | 5 per stop, then `OTP_ATTEMPTS_EXCEEDED` (429). The app surfaces this and offers the S1 exception path. |
| Storage | Hashed, not plaintext. Compare in constant time. |
| Single use | Yes — a code that completed a delivery must not verify again. |

---

## S5 — Distinguish "both proofs captured" from "one"

### Current behaviour

`type` names exactly one proof. The app enforces a **two-step chain** — photo, then OTP,
both mandatory for every drop-off — but has to send `type: "otp"` and upload the photo
separately. The backend therefore **cannot verify that the policy it relies on was
followed.** Every delivery looks OTP-only.

### Required

- Accept `photo_captured: bool` on `deliver/` and store it.
- When `photo_captured` is true, verify a proof row actually exists for that stop
  (via S2's `stop_id`). If not, reject with `PROOF_REQUIRED` — the claim is false.
- Optionally widen `type` to accept `"otp_photo"`. If you do, **keep accepting `"otp"` and
  `"photo"` unchanged** — old clients only send those.

Once shipped, "was proof of delivery actually captured?" becomes an answerable question
for the first time.

---

## S6 — Rate-limit the rider **login** OTP

This one is about `/api/auth/send-otp/` — the rider's own code. Separate system from S4;
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
- Same lifecycle rules as S4: resend invalidates the previous code, hashed storage,
  constant-time compare, single use, capped verify attempts.

### Enumeration

`send-otp/` is unauthenticated. Return the **same** response shape and timing whether or
not the number belongs to a registered rider — otherwise the endpoint is a free
"is this number a FreshOn rider?" oracle. Rate-limit by IP regardless of phone validity.

---

## S7 — Make `deliver/` idempotent

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

**Critically:** whatever side effects a delivery has — earnings credited, the trip
advanced, the customer notified — must happen **once**. Idempotency here is what stops a
retry from paying a rider twice for one drop.

---

## 3. Suggested rollout order

Each step is independently deployable and safe on its own.

| # | Change | Why here |
| --- | --- | --- |
| 1 | **S1** error codes | Retires the client's English pattern-matching. Zero risk, purely additive. |
| 2 | **S7** idempotent deliver | Fixes a live "stuck rider" case: the delivery recorded, the rider shown a failure. |
| 3 | **S2** proof provenance + idempotency | Makes the client's upload retries safe, and gives a proof photo a when and a where. |
| 4 | **S4** + **S6** rate limits | Abuse control on both OTP endpoints. Independent of everything above. |
| 5 | **S3** exception flagging | Needs S2's `stop_id` to check a proof exists. |
| 6 | **S5** proof verification | Needs S2 and S3 in place to be meaningful. |

S1 first is deliberate: until `error_code` exists, the app is reading your English error
strings to decide how to react. Every step after it is safer once that is gone.

---

## 4. What must NOT change

- `deliver/` must keep accepting `{stop_id, type, otp_code, latitude, longitude}` with no
  new fields, and behave as it does today.
- `/proof/` must keep accepting `{mission_id, photo}` alone.
- `type` must keep accepting `"otp"` and `"photo"`.
- Existing `error` strings should stay stable until `error_code` (S1) is deployed and the
  client's fallback matcher is removed — the app currently reads them.
- The 300 m delivery geofence stays. The app added its own 400 m gate in front of it as a
  courtesy, so riders stop discovering the refusal *after* taking a photo and asking for a
  code. It is not a replacement.
- Do not add `autocomplete="one-time-code"` semantics to the customer handover code — see §1.

---

## 5. Verification

A Bruno collection covering every endpoint lives in `bruno/` in the app repo. The relevant
requests are `15`–`18` (assignment pickup / transit / deliver / resend-otp) and `21`
(upload proof). Point `baseUrl` at your environment, set `deviceKey` from request `2`, and
fill the rest into your own environment — the committed collection carries no credentials.

Per-change acceptance tests are listed inline above; S2 has the fullest set.

### End-to-end check once S1–S3 and S7 are in

1. Dispatch a trip with two drops. Pick up at the hub.
2. At the first drop, submit `deliver/` with a wrong code → `400`,
   `error_code: "INVALID_OTP"`. The app clears the boxes and asks again.
3. Submit from outside the geofence → `400`, `error_code: "OUTSIDE_GEOFENCE"` with
   `distance_m`. The app leaves the typed code alone and tells the rider to walk closer.
4. Upload a proof photo twice with the same `capture_id` → one stored row, `200` both
   times, second carrying `duplicate: true`.
5. Complete the stop correctly → `200`, proof row linked to the stop.
6. Replay that exact `deliver/` request → `200` with the original result, **not** a
   `409`. This is the lost-response case from S7.
7. At the second drop, exhaust the code attempts, then complete via the exception path →
   `200`, delivery stored with `exception_reason: "OTP_UNAVAILABLE"` and flagged for
   review. Confirm the geofence was still enforced on that path.
