// packages/freshon-api/src/modules/profile.ts
// Customer profile module — unified address, preferences, settings.
// Maps to Django's CustomerProfileDataView in apps/accounts/views.py.
import { getClient } from "../client";
/**
 * Get the customer's full profile (address + preferences + settings) in one call.
 * GET /api/auth/profile-data/
 */
export async function getProfile() {
    const res = await getClient().get("/api/auth/profile-data/");
    return res.data;
}
/**
 * Update profile data — can send any combination of address, preferences, settings.
 * PATCH /api/auth/profile-data/
 */
export async function updateProfile(data) {
    const res = await getClient().patch("/api/auth/profile-data/", data);
    return res.data;
}
//# sourceMappingURL=profile.js.map