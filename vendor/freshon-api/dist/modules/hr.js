// packages/freshon-api/src/modules/hr.ts
// HR fingerprint attendance — the POS-side half of the Mantra MFS110
// integration. Capture + local 1:N matching happen in the Tauri Rust layer
// (Fpos/src-tauri/src/fingerprint.rs, only that terminal has the vendor SDK);
// this module only talks to the cloud: pull enrolled templates to match
// against, enroll a new one, and report a matched check-in/out.
// Maps to apps/hr/fingerprint_views.py.
import { getClient } from "../client";
/** All enrolled templates for active employees — cache this on the POS
 * terminal and re-fetch after each enrollment. GET /api/hr/fingerprint/templates/ */
export async function listFingerprintTemplates() {
    const res = await getClient().get("/api/hr/fingerprint/templates/");
    return res.data;
}
/** Active employee roster, for the enroll screen's picker.
 * Requires the logged-in session to have HR view access — the manager PIN
 * step-up on the enroll POST below is a separate, additional gate.
 * GET /api/hr/employees/ */
export async function listActiveEmployees() {
    const res = await getClient().get("/api/hr/employees/");
    return res.data;
}
/** Enroll or re-enroll one employee's template (by employee_id, e.g.
 * "EMP-001"). Gated by a manager PIN entered on the spot (step-up auth, same
 * pattern as the shift-close safe drop) — not by whichever operator the POS
 * session belongs to. POST /api/hr/fingerprint/templates/ */
export async function enrollFingerprintTemplate(employeeId, templateBase64, quality, managerPin) {
    const res = await getClient().post("/api/hr/fingerprint/templates/", {
        employee: employeeId,
        template_data: templateBase64,
        quality,
        manager_pin: managerPin,
    });
    return res.data;
}
/** Report the employee the POS's local matcher identified (by the
 * human-facing employee_id, e.g. "EMP-001" — the only identifier the matcher
 * has, straight out of FingerprintTemplateRecord). Toggles today's
 * check_in/check_out. POST /api/hr/fingerprint/checkin/ */
export async function reportFingerprintCheckin(employeeId) {
    const res = await getClient().post("/api/hr/fingerprint/checkin/", {
        employee_id: employeeId,
    });
    return res.data;
}
//# sourceMappingURL=hr.js.map