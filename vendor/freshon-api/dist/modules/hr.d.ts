export interface FingerprintTemplateRecord {
    employee_id: string;
    employee_name: string;
    template_data: string;
    quality: number;
    updated_at: string;
}
/** Minimal shape of GET /api/hr/employees/ — enough to populate an enroll picker. */
export interface HrEmployeeSummary {
    id: string;
    name: string;
    role: string;
}
export interface FingerprintCheckinResult {
    id: number;
    employee: number;
    employee_id: string;
    employee_name: string;
    date: string;
    status: string;
    check_in: string | null;
    check_out: string | null;
    source: string;
    note: string;
    action: "check_in" | "check_out";
}
/** All enrolled templates for active employees — cache this on the POS
 * terminal and re-fetch after each enrollment. GET /api/hr/fingerprint/templates/ */
export declare function listFingerprintTemplates(): Promise<FingerprintTemplateRecord[]>;
/** Active employee roster, for the enroll screen's picker.
 * Requires the logged-in session to have HR view access — the manager PIN
 * step-up on the enroll POST below is a separate, additional gate.
 * GET /api/hr/employees/ */
export declare function listActiveEmployees(): Promise<HrEmployeeSummary[]>;
/** Enroll or re-enroll one employee's template (by employee_id, e.g.
 * "EMP-001"). Gated by a manager PIN entered on the spot (step-up auth, same
 * pattern as the shift-close safe drop) — not by whichever operator the POS
 * session belongs to. POST /api/hr/fingerprint/templates/ */
export declare function enrollFingerprintTemplate(employeeId: string, templateBase64: string, quality: number, managerPin: string): Promise<FingerprintTemplateRecord>;
/** Report the employee the POS's local matcher identified (by the
 * human-facing employee_id, e.g. "EMP-001" — the only identifier the matcher
 * has, straight out of FingerprintTemplateRecord). Toggles today's
 * check_in/check_out. POST /api/hr/fingerprint/checkin/ */
export declare function reportFingerprintCheckin(employeeId: string): Promise<FingerprintCheckinResult>;
//# sourceMappingURL=hr.d.ts.map