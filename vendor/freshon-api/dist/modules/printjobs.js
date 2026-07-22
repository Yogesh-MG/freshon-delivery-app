// packages/freshon-api/src/modules/printjobs.ts
// Print-job log + reprint. Fpick records every label print; a FOS manager lists
// recent jobs and reprints a missed one. Maps to apps/inventory/print_views.py.
import { getClient } from "../client";
/** Fpick: record a print job (the labels just sent to the printer). */
export async function recordPrintJob(data) {
    const res = await getClient().post("/api/inventory/print-jobs/", data);
    return res.data;
}
/** FOS manager: recent print jobs to reprint from. */
export async function getRecentPrintJobs(params) {
    const res = await getClient().get("/api/inventory/print-jobs/recent/", { params });
    return res.data;
}
/** FOS manager: record a reprint (with why) and get back the stored labels to
 * print. `reason` is required by the backend — a missed label print is an
 * operational miss worth a record of why it recurred. */
export async function reprintJob(id, reason) {
    const res = await getClient().post(`/api/inventory/print-jobs/${id}/reprint/`, { reason });
    return res.data;
}
/** FOS manager: find ONE pack's stored label by its barcode/serial — for a pack
 * whose sticker is lost and whose print job is no longer in the recent list.
 * Returns the exact label payload + its parent job (call reprintJob(job.id, …)
 * afterwards to record the reprint). Throws 404 if the barcode was never printed. */
export async function getLabelByBarcode(barcode) {
    const res = await getClient().get("/api/inventory/print-jobs/label-by-barcode/", { params: { barcode } });
    return res.data;
}
/**
 * Where this print run's packs were put.
 *
 * Read this when a screen (re)opens a job — after a reprint, or a back-out and
 * back in — so the mapping is restored rather than starting blank. It is stored
 * server-side precisely so a reprint can't lose it: a reprint replays the same
 * job's same labels, so the placement still applies.
 */
export async function getPrintJobPlacements(jobId) {
    const res = await getClient().get(`/api/inventory/print-jobs/${jobId}/placements/`);
    return res.data;
}
/**
 * Put packs on a rack. `location` is the scanned H-Aisle-Shelf-Bin code (or a
 * Location id).
 *
 * Re-posting a rack merges into it; a pack already on a different rack of this
 * job MOVES (returned in `moved`) — a packet is in exactly one place. An unknown
 * or retired rack, or a barcode this job never printed, is refused.
 */
export async function placePrintJobPacks(jobId, data) {
    const res = await getClient().post(`/api/inventory/print-jobs/${jobId}/placements/`, data);
    return res.data;
}
//# sourceMappingURL=printjobs.js.map