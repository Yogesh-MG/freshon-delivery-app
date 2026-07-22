export interface HubLocation {
    id: string;
    /** The scannable code, e.g. "H-A1-S2-B3" — exactly what the sticker's QR encodes. */
    code: string;
    hub: string;
    hub_name: string | null;
    aisle: string;
    shelf: string;
    bin: string;
    name: string;
    /** Retired shelves keep their row (the sticker is still on the rack) — a scan
     * of one resolves with is_active false rather than 404ing like a broken scanner. */
    is_active: boolean;
    created_at: string;
}
export interface GenerateLocationsResult {
    created: HubLocation[];
    existing: HubLocation[];
    created_count: number;
    existing_count: number;
}
/** The shelf grid. Filter by hub/aisle, or `active: true` for shelves in use. */
export declare function listLocations(params?: {
    hub?: string;
    aisle?: string;
    active?: boolean;
}): Promise<{
    locations: HubLocation[];
}>;
/** FOS: create an aisle × shelf × bin grid of shelves.
 *
 * Idempotent by coordinate — re-running after adding one aisle creates only the
 * new shelves and returns the rest under `existing`, so "we added a rack" doesn't
 * need anyone to hand-pick what's new. Throws 409 if another hub already owns one
 * of the codes (shelf codes are global — the scanned code has no hub segment). */
export declare function generateLocations(data: {
    hub: string;
    aisles: string[];
    shelves: string[];
    bins: string[];
}): Promise<GenerateLocationsResult>;
/** FOS: rename or retire one shelf. Coordinates aren't editable — they derive
 * `code`, which is already printed on a sticker glued to that rack. */
export declare function updateLocation(id: string, data: {
    name?: string;
    is_active?: boolean;
}): Promise<HubLocation>;
//# sourceMappingURL=locations.d.ts.map