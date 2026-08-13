# FreshOn delivery API — required changes

**For whoever is implementing this on the backend (Django/DRF behind `https://api.freshon.in`).**
Self-contained: you should not need the rider app's source.

This is **round two**. Round one was partly implemented and partly wrong, and the wrong
parts were found by testing the live API with a real rider account. § 1 lists exactly what
broke, because two of those bugs are worse than the problems they were meant to fix.

Read § 0 and § 1 before writing any code.

---

## 0. Rules that apply to every change here

### 0.1 Never let an unknown value take a success path

This is the single most important line in this document. The critical bug in round one
(**B1**) was a branch on `type` with no rejecting `else`, so an unrecognised value fell
through every check and returned `200`.

> **Unknown enum value → `400`. Always. No fall-through, no default branch that proceeds.**

Applies to `type`, `exception_reason`, `method`, and every enum added later.

### 0.2 Validate in this order, always

Round one returned `OTP_EXPIRED` for a request with no `stop_id` at all, because the OTP
branch ran before required-field validation. The rider was told to make the customer
request a fresh code in order to fix a malformed request.

```
1. Required fields present and well-formed      → 400 VALIDATION_ERROR
2. Objects exist and belong to this rider       → 404 NOT_FOUND
3. stop_id belongs to this assignment           → 400 STOP_MISMATCH
4. State allows this action                     → 409
5. Already done? → idempotent success (§ 0.5)
6. OTP / proof checks                           → 400
7. Geofence                                     → 400
8. Perform the write
```

### 0.3 Backward compatibility is mandatory

Riders run whatever build is on their phone; old versions live in the field for weeks.

- Every new **request** field is optional. A request with none of them behaves exactly as
  it does today.
- Every new **response** field is additive. Never remove or repurpose an existing key.
- Never tighten an existing validation. If a new rule would reject what an old client
  sends, gate the rule on the new field being present.

Concretely, this must keep working forever:
`POST deliver/ {stop_id, type, otp_code, latitude, longitude}`

### 0.4 Do not trust the client

`captured_at`, `latitude`, `longitude`, `accuracy_m` and `photo_captured` are all asserted
by the app, and are exactly what someone would forge to close a stop they are not at.
Record them, cross-check against server-side truth where you can, and never let them
*replace* a server-side check.

### 0.5 Every write is idempotent

The rider's network drops constantly — lifts, basements, stairwells. A lost response is
normal, and the retry that follows must not double-apply anything. This covers `deliver/`,
`/proof/`, `pickup/`, `accept/` and `wallet/withdraw/`.

> **A repeat of an action already performed by the same rider returns `200` with the
> original result — not `409`, not a second write.**

### 0.6 Error shape

Every non-2xx from `/api/delivery-partner/*` and `/api/auth/*`:

```json
{ "error": "Human sentence the rider could act on.", "error_code": "MACHINE_CODE" }
```

`error` stays for old clients. `error_code` is what the app branches on. Extra context
(`distance_m`, `current_state`, `retry_after_seconds`) is welcome as additional keys.

---

## 1. What round one got wrong

Verified against the live API on 12 Aug 2026 with a real rider account. **Fix these first —
two of them are worse than the original problem.**

### B1 — `deliver/` accepts an unknown `type` and returns 200 · critical

```
POST /assignments/433fa92f…/deliver/
{"stop_id":"433e28c9…","type":"banana","otp_code":"123456"}
→ 200 {"message":"Delivery proof recorded!"}
```

No OTP check. No geofence — no coordinates were even sent. And that `stop_id` belonged to a
**different trip**. Every guard was skipped because the value fell outside the recognised set.

Two ways this hurts. *Honest:* the app treats any non-error response as success, so the
rider sees "Delivery complete", the stop leaves their list, and they ride off while the
order is still open — nobody knows until the customer calls. *Dishonest:* a rider login
becomes a button for closing work from home.

**Fix:** restrict `type` to `{"otp","photo"}`; anything else is `400 INVALID_TYPE`. See § 0.1.

### B2 — `deliver/` never checks the stop belongs to the assignment · critical

A `stop_id` from one trip, posted against another trip's assignment, is processed.
`/proof/` already does this correctly with `STOP_MISMATCH`; `deliver/` has no equivalent.
A rider carrying two batches can close the **wrong customer's order**.

**Fix:** port the `/proof/` check. `400 STOP_MISMATCH`.

### B3 — `accept/` on a live trip silently rewinds it

Calling `accept/` on a trip already `ACTIVE` returns it as `ASSIGNED`, discarding the
completed hub pickup and every bag scan with it. A rider who scanned nine bags and
re-entered the trip loses all nine.

**Fix:** idempotent — re-accepting a trip you already hold returns its current state
unchanged. Someone else's is `409 TRIP_TAKEN`. Never move a trip backwards.

### B4 — The login lockout is inescapable

The 30-second cooldown **is not enforced**: a second request 2 seconds later returned `200`
and sent a second SMS. But when the send allowance runs out, exhaustion is reported as if
it were that cooldown:

```
429 {"error":"Please wait 30s before requesting another code.",
     "error_code":"OTP_COOLDOWN","cooldown_seconds":30,"resends_remaining":0}
Retry-After: 30
```

Waiting the full 30 s returns exactly the same response. The rider waits, retries, loops
forever, and never learns the real wait. **This locked a real account out during testing.**

So the limit that should stop SMS spend doesn't work, and the one that does work reports
itself as something it isn't.

**Fix:** enforce the cooldown; give exhaustion its own code with the true reset (§ 6).

### B5 — A trip cannot be released once `ACTIVE`

`cancel/` is refused from `ACTIVE`. Confirming hub pickup moves a trip `ASSIGNED → ACTIVE`,
and there is no way back. A rider whose bike breaks down cannot hand the trip back: the
order is welded to them, invisible to the pool, until someone edits the database.

**Not hypothetical — order `FRSH-7BA220` / assignment
`433fa92f-c34f-40bd-8769-24b25faefd5d` is in exactly this state right now.** It needs a
manual reset: trip `c466cef7` back to `PENDING`, rider unassigned, `bag_scanned` cleared on
its drop-off. No customer order was falsely marked delivered.

**Fix:** § 7.

### B6 — Wrong error for a missing field

Omitting `stop_id` returns `OTP_EXPIRED`. See § 0.2.

### B7 — `error_code` stops short

Correct on `deliver/` and throughout `/proof/`. **Missing** on `accept/` 404, `transit/`
404, `pickup/`'s stop-mismatch 400, and `cancel/`'s state refusal.

### B8 — Counter and payload inconsistencies

- `resends_remaining` counts `3 → 2 → 0`, skipping 1.
- Trip `5dfb1256` reports `stop_count: 3` but returns 2 stops, so the rider's screen
  disagrees with the trip summary about how much work they have.

### What round one got right — leave these alone

- `error_code` on `deliver/`'s OTP and state paths (`INVALID_OTP`, `NOT_IN_TRANSIT`/409).
- **All of `/proof/`**: the provenance fields, `capture_id` idempotency returning the same
  row id with `duplicate: true`, the `STOP_MISMATCH` guard, and magic-byte file validation
  that correctly rejected a mislabelled empty file. This one was done properly.

---

## 2. The two OTPs are different systems

The likeliest source of a wrong fix. They share nothing.

| | **Rider login OTP** | **Customer handover OTP** |
| --- | --- | --- |
| Endpoint | `POST /api/auth/send-otp/` → `verify-otp/` | `POST /assignments/{id}/resend-otp/` → verified inside `deliver/` |
| Sent to | the **rider's** phone | the **customer's** phone |
| Proves | the rider may sign in | the customer received the parcel |
| Auth | none — this *is* the login | rider's Bearer key |
| Scope | a phone number | one assignment / stop |
| Covered in | § 6 | § 5 |

`resend-otp/` under `/assignments/{id}/` is the **customer's** code. It has nothing to do
with logging in.

One consequence worth keeping: the rider's own login code may be SMS-autofilled by their
phone. The customer's handover code must **never** be autofillable on the rider's device —
the app deliberately omits `autocomplete="one-time-code"` there. Don't "helpfully" add it.

**Cash on delivery is withdrawn.** An earlier draft asked for COD persistence, `cod_amount`
on stop payloads, and a rider cash balance. **All three are cancelled** — the app no longer
collects cash and sends no COD fields at all. Do not build them.

---

## 3. `POST /assignments/{id}/deliver/`

The most important endpoint in the system. Everything in § 0 applies.

### Request

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `stop_id` | uuid | yes | must belong to `{id}` |
| `type` | `"otp"` \| `"photo"` | yes | **reject anything else** |
| `otp_code` | string(6) | when `type="otp"` | |
| `latitude` / `longitude` | float | no | absent when the device had no fix |
| `accuracy_m` | float | no | error radius of that fix |
| `photo_captured` | bool | no | a proof photo was uploaded for this stop |
| `proof_url` | string | no | the URL `/proof/` returned |
| `exception_reason` | `"OTP_UNAVAILABLE"` | no | only valid with `type="photo"` |

### Behaviour

Validate in the § 0.2 order, then:

- **`type:"otp"`** — normal path. Verify the code, then the geofence, then complete.
- **`type:"photo"` + `exception_reason`** — the no-code path, used when the customer cannot
  supply a code (phone off, wrong number on file, SMS never arrived). Require a proof photo
  for the stop, **still enforce the geofence**, complete, and flag for review.
- **`type:"photo"` without `exception_reason`** — legacy clients. Accept as today.
- **`photo_captured: true`** — verify a proof row exists for this stop (via `/proof/`'s
  `stop_id`). If not, `400 PROOF_REQUIRED`; the claim is false.

### Error codes

| `error_code` | HTTP | When |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | missing/malformed field — **before** any OTP check |
| `INVALID_TYPE` | 400 | `type` outside the allowed set |
| `NOT_FOUND` | 404 | assignment unknown or not this rider's |
| `STOP_MISMATCH` | 400 | `stop_id` not on this assignment |
| `NOT_IN_TRANSIT` | 409 | wrong state; include `current_state` |
| `INVALID_OTP` | 400 | code does not match |
| `OTP_EXPIRED` | 400 | code aged out |
| `OTP_ATTEMPTS_EXCEEDED` | 429 | too many wrong codes for this stop |
| `OUTSIDE_GEOFENCE` | 400 | too far; **include `distance_m`** |
| `LOCATION_REQUIRED` | 400 | no coordinates and the stop is geofenced |
| `PROOF_REQUIRED` | 400 | `photo_captured` or exception path with no proof row |
| `INVALID_EXCEPTION` | 400 | unknown `exception_reason`, or sent with `type="otp"` |
| `ALREADY_DELIVERED` | 409 | delivered by a **different** rider |

### Idempotency

Same rider re-delivering the same stop → `200` with the original result. Side effects —
earnings credited, trip advanced, customer notified — happen **exactly once**.

Why it matters: without this, a `deliver/` whose response is lost leaves the delivery
recorded and the rider shown a failure. Their retry then hard-errors on a stop that is
already complete, and they are stuck with no route forward.

### Edge cases — each needs a defined answer

| Case | Required behaviour |
| --- | --- |
| Already delivered by **this** rider | `200`, original result, no second write |
| Already delivered by **another** rider | `409 ALREADY_DELIVERED` |
| Stop has no coordinates on record | Skip the geofence — neither end can measure it. Do **not** reject |
| No coordinates sent, stop **is** geofenced | `400 LOCATION_REQUIRED` |
| `accuracy_m` very large (e.g. 500 m) | Widen the geofence by the reported accuracy, capped around 150 m. A poor urban fix must not lock a rider out at the door |
| Trip cancelled mid-delivery | `409 NOT_IN_TRANSIT` with `current_state` |
| Two `deliver/` calls arrive concurrently | Row-lock the stop; one wins, the other returns the same result |
| Correct OTP, outside geofence | `OUTSIDE_GEOFENCE`, and **do not consume an OTP attempt** — the code was right |
| Wrong OTP **and** outside geofence | `INVALID_OTP` — the cheaper check first is fine |
| `otp_code` malformed (non-numeric, wrong length) | `VALIDATION_ERROR`, and **not** counted as an attempt |
| Last stop on a trip | Complete the trip in the same transaction |
| Rider's device clock is wrong | Irrelevant here — never derive expiry from a client timestamp |

---

## 4. `POST /proof/` — mostly done

Round one implemented this correctly. Two things remain:

1. **Link the proof to the delivery.** With `stop_id` here and `proof_url` on `deliver/`,
   attach the row to the stop it evidences. Today they are unrelated writes joined only by
   `mission_id`.
2. **`captured_at` skew.** Store the client value *and* your own `received_at`. Flag skew
   beyond ~24 h; **never reject on it** — a rider with a wrong device clock cannot fix that
   at a customer's door.

Keep the upload limit generous (≥ 10 MB). New clients send 150–250 KB, but old builds still
send multi-megabyte photos and must keep working.

---

## 5. `POST /assignments/{id}/resend-otp/` — the customer's code

Rate-limit per assignment, per rider, **and** per destination phone — a rider cycling
between stops must not sidestep a per-stop limit. Suggested: 45 s between sends, 5 per
assignment, 20 per rider per hour.

```json
{ "sent": true, "cooldown_seconds": 45, "resends_remaining": 3 }
```

On refusal: `429` + `Retry-After`, with `error_code` of `RESEND_COOLDOWN` **or**
`RESEND_LIMIT`. **These are different states and must not share a code** — conflating them
is exactly B4.

### Lifecycle — currently undocumented, please pin down

| Question | Required |
| --- | --- |
| Does a resend invalidate the previous code? | **Yes.** One active code per stop — two valid codes doubles the guessing surface and confuses a customer reading the older SMS |
| Expiry | 15–30 minutes |
| Wrong attempts before lockout | 5 per stop, then `OTP_ATTEMPTS_EXCEEDED` (429). The app then offers the § 3 exception path |
| Storage | Hashed, compared in constant time |
| Single use | Yes — a code that closed a delivery must never verify again |

---

## 6. `POST /api/auth/send-otp/` — the rider's login code

- **Actually enforce** the cooldown (B4): 30 s between sends, per phone **and** per IP.
- Separate the two refusal states:

| State | HTTP | `error_code` | `Retry-After` |
| --- | --- | --- | --- |
| Within the cooldown | 429 | `OTP_COOLDOWN` | seconds left on the cooldown |
| Allowance exhausted | 429 | `OTP_RESEND_LIMIT` | seconds until the **window resets** |

The success shape is already correct — keep it, and fix the `resends_remaining`
off-by-one (B8).

### Enumeration

`send-otp/` is unauthenticated. Return the **same response shape and the same timing**
whether or not the number belongs to a registered rider, or the endpoint is a free "is this
number a FreshOn rider?" oracle. Rate-limit by IP regardless of phone validity.

### Sessions

A new login currently invalidates the existing device key with no signal to the device
losing it. A rider who signs in on a spare phone is silently ejected from the one in their
hand — mid-delivery, losing the proof photo they just captured.

Either allow more than one active device per rider, or return
`401 {"error_code": "SESSION_SUPERSEDED"}` so the app can say "you signed in on another
device" instead of behaving like a crash.

---

## 7. Trip lifecycle

### `accept/`
Idempotent (B3). Re-accepting your own trip returns its current state; someone else's is
`409 TRIP_TAKEN`. Never move a trip backwards.

### `cancel/` — must work from `ACTIVE` (B5)
Riders break down, get injured, and have family emergencies. The system needs an answer.

- From `PENDING` / `ASSIGNED`: as today — back to the pool.
- From `ACTIVE`: **allow it.** Return undelivered stops to the pool, keep completed ones
  completed, clear `bag_scanned` on what goes back, record who abandoned it and when, and
  flag it for ops.
- If you would rather keep `cancel/` strict, add `POST /trips/{id}/hand-back/` with that
  behaviour instead. Either is fine — a rider with a broken bike must have *some* route.

### `pickup/` and `transit/`
Add `error_code` (B7). Make `pickup/` idempotent: re-sending the same bag batch returns the
current trip rather than an error.

### Payload consistency
`stop_count` must equal `len(stops)` (B8).

---

## 8. `POST /wallet/withdraw/`

Accept a client-supplied idempotency key and return the existing withdrawal on a repeat.

There is nothing to deduplicate on today. The app guards double-taps in the UI, but a lost
response is invisible to that guard: rider requests ₹2,000, the response dies, they tap
again — **two withdrawals, ₹4,000 out**. You already solved this class of problem correctly
for proof photos with `capture_id`; money deserves at least that.

---

## 9. Order of work

| # | Do | Why here |
| --- | --- | --- |
| 1 | **B1** + **B2** | Same code path, same afternoon. B1 is an open door |
| 2 | **B5** + reset `FRSH-7BA220` | A live order is stuck right now |
| 3 | **B4** + § 6 | Riders locked out of their own shift |
| 4 | § 3 idempotency + **B6** | Stops riders being stranded by lost responses |
| 5 | **B3**, **B7**, **B8** | State and reporting correctness |
| 6 | § 5 resend limits, § 8 withdrawal key | Abuse and money safety |
| 7 | § 3 exception path + `PROOF_REQUIRED`, § 4 linking | Evidence integrity |

---

## 10. Acceptance tests

Please write these. Round one passed a casual look and failed all of 1–4.

**Type and ownership**
1. `type:"banana"` → `400 INVALID_TYPE`, nothing written *(B1)*
2. `type` absent → `400 VALIDATION_ERROR`
3. `stop_id` from another assignment → `400 STOP_MISMATCH` *(B2)*
4. `stop_id` absent → `400 VALIDATION_ERROR`, **not** `OTP_EXPIRED` *(B6)*

**Idempotency**
5. Deliver a stop, then replay the identical request → `200`, same result, earnings
   credited **once**, one customer notification
6. Two concurrent `deliver/` calls → one write, both `200`
7. `accept/` on a trip you already hold, mid-pickup → state unchanged, bag scans intact *(B3)*
8. Same `capture_id` twice → one row, `duplicate:true` on the second
9. Same idempotency key twice to `withdraw/` → one withdrawal

**OTP**
10. Wrong code 5× → `429 OTP_ATTEMPTS_EXCEEDED`
11. Correct code, rider 2 km away → `OUTSIDE_GEOFENCE` **with `distance_m`**, attempt
    counter **unchanged**
12. Resend → the previous code no longer verifies
13. `send-otp/` twice inside 30 s → second is `429 OTP_COOLDOWN` **and no second SMS is
    sent** *(B4)*
14. Exhaust the allowance → `429 OTP_RESEND_LIMIT`, `Retry-After` is the real reset, and
    waiting that long actually works *(B4)*
15. `send-otp/` for an unregistered number → same shape and timing as a registered one

**Lifecycle**
16. Cancel an `ACTIVE` trip → undelivered stops back in the pool, completed ones untouched *(B5)*
17. Every 4xx/5xx across `deliver/`, `pickup/`, `transit/`, `accept/`, `cancel/`,
    `resend-otp/` carries an `error_code` *(B7)*
18. `stop_count == len(stops)` on every trip payload *(B8)*

**Backward compatibility**
19. `deliver/` with only `{stop_id, type, otp_code, latitude, longitude}` → works exactly
    as before
20. `/proof/` with only `{mission_id, photo}` → works, no `capture_id` required

---

## 11. Verification

A Bruno collection covering every endpoint is in `bruno/` in the app repo — requests 15–18
(pickup / transit / deliver / resend-otp) and 21 (upload proof). Point `baseUrl` at your
environment and fill `deviceKey` into your own; the committed collection carries no
credentials.

**Please test on staging, not production.** Round one's problems were found on production
against real customer orders, which is why four checks — the exception path,
`photo_captured` / `PROOF_REQUIRED`, `deliver/` idempotency, and the geofence itself —
have **still never been verified**. Reaching them requires completing a real delivery, and
that could not be done safely on live data. On staging, run all of § 10.
