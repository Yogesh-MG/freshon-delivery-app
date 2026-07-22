// packages/freshon-api/src/modules/petpooja.ts
// Petpooja Payroll API integration endpoints.
// These map to the Django backend endpoints that securely communicate with Petpooja.
import { getClient } from "../client";
/**
 * Trigger a manual sync of Petpooja attendance data.
 * POST /api/accounts/petpooja/sync/
 */
export async function syncAttendance(data) {
    const res = await getClient().post("/api/accounts/petpooja/sync/", data);
    return res.data;
}
/**
 * Fetch synchronized attendance punch records from our backend.
 * GET /api/accounts/petpooja/punches/
 */
export async function getPunches(params) {
    const res = await getClient().get("/api/accounts/petpooja/punches/", { params });
    return res.data;
}
//# sourceMappingURL=petpooja.js.map