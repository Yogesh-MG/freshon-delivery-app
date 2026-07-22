import type { PetpoojaSyncRequest, PetpoojaSyncResponse, AttendancePunchRecord } from "../types";
/**
 * Trigger a manual sync of Petpooja attendance data.
 * POST /api/accounts/petpooja/sync/
 */
export declare function syncAttendance(data: PetpoojaSyncRequest): Promise<PetpoojaSyncResponse>;
/**
 * Fetch synchronized attendance punch records from our backend.
 * GET /api/accounts/petpooja/punches/
 */
export declare function getPunches(params?: {
    date?: string;
    employee_id?: string;
}): Promise<AttendancePunchRecord[]>;
//# sourceMappingURL=petpooja.d.ts.map