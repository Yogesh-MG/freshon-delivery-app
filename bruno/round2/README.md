# Round-two delivery API tests (Bruno)

Negative-path / behaviour requests for the round-two changes in
`Del_app/docs/SERVER_CHANGES.md`. Each `.bru` carries an `assert` block, so
**Run** (▶) in Bruno — or `bru run round2 --env prod` on the CLI — actually
verifies the contract, not just fires the call.

## Setup
1. Open the `Freshon Delivery` collection, pick the **prod** environment.
2. Auth: get a `deviceKey` from `1 Send OTP` → `2 Verify OTP` (or paste one into
   the `deviceKey` secret var). All authed requests send `Authorization: Bearer {{deviceKey}}`.
3. Fill the env vars the round-two cases need:
   - `assignmentId`, `stopId` — a stop on an IN_TRANSIT assignment you own.
   - `foreignStopId` — a stop UUID from a **different** assignment (for STOP_MISMATCH).
   - `tripId` — a trip you hold **ACTIVE** (for the hand-back test).
   - `takenTripId` — a trip owned by **another** rider (for TRIP_TAKEN).
   - `deliveryOtp` — the real customer code, for the geofence / replay cases.
   - `idempotencyKey` — used by `28 Request withdrawal`; the repeat-key test uses a
     fixed literal key on purpose.

## What each request checks
| Request | Spec | Asserts |
| --- | --- | --- |
| R1 deliver-invalid-type | B1 | 400 `INVALID_TYPE`, nothing written |
| R2 deliver-missing-stop | B6 | 400 `VALIDATION_ERROR` (not `OTP_EXPIRED`) |
| R3 deliver-foreign-stop | B2 | 400 `STOP_MISMATCH` |
| R4 deliver-outside-geofence | §3 | 400 `OUTSIDE_GEOFENCE` + `distance_m`; code NOT consumed |
| R5 deliver-replay-idempotent | §3 | run twice → 200 `already_delivered`, credited once |
| R6 trip-handback-active | B5 | 200 `returned_orders` from ACTIVE |
| R7 trip-accept-taken | B3 | 409 `TRIP_TAKEN` |
| R8 withdraw-idempotent | §8 | same key → same withdrawal `id`, one debit |
| R9 send-otp-cooldown | B4 | `OTP_COOLDOWN` vs `OTP_RESEND_LIMIT` |

## Note
Some cases are **stateful** (replay, withdraw-idempotent, send-otp cooldown): the
assertion holds on the *second* call, or after the described setup. The docs block in
each request spells out the sequence. **Run on staging, not production** — several of
these complete or cancel real work.
