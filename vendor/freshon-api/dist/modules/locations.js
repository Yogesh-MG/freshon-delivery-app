// packages/freshon-api/src/modules/locations.ts
// Hub shelf/rack locations — the scannable aisle/shelf/bin grid. FOS defines the
// grid and prints a QR sticker per shelf; a hub scanner resolves the sticker back
// through /api/inventory/barcode-lookup/. Maps to apps/inventory/location_views.py.
//
// Named HubLocation, not Location: "location" already means lat/long elsewhere in
// this codebase (Fpick's hubLocation), and a bare `Location` would collide with
// the DOM type once re-exported from the barrel.
import { getClient } from "../client";
/** The shelf grid. Filter by hub/aisle, or `active: true` for shelves in use. */
export async function listLocations(params) {
    const res = await getClient().get("/api/inventory/locations/", { params });
    return res.data;
}
/** FOS: create an aisle × shelf × bin grid of shelves.
 *
 * Idempotent by coordinate — re-running after adding one aisle creates only the
 * new shelves and returns the rest under `existing`, so "we added a rack" doesn't
 * need anyone to hand-pick what's new. Throws 409 if another hub already owns one
 * of the codes (shelf codes are global — the scanned code has no hub segment). */
export async function generateLocations(data) {
    const res = await getClient().post("/api/inventory/locations/generate/", data);
    return res.data;
}
/** FOS: rename or retire one shelf. Coordinates aren't editable — they derive
 * `code`, which is already printed on a sticker glued to that rack. */
export async function updateLocation(id, data) {
    const res = await getClient().patch(`/api/inventory/locations/${id}/`, data);
    return res.data;
}
//# sourceMappingURL=locations.js.map