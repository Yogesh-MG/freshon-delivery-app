export type PrintJobType = "INGESTION" | "PICKING" | "SHIPPING" | "LOCATION" | "OTHER";
/** A stored label payload — the exact params passed to the builder named by the
 * job's `label_type`: "product" (product labels), "handover" (delivery bags), or
 * "location" (shelf/rack stickers). The reprint path branches on label_type, so
 * a payload must only ever be rendered by the builder that produced it. */
export interface PrintLabelPayload {
    productName?: string;
    unit?: string;
    batchId?: string;
    barcode?: string;
    mrp?: number | string;
    packedOn?: string;
    bestBefore?: string;
    trackingId?: string;
    bagIndex?: number;
    totalBags?: number;
    bagCode?: string;
    code?: string;
    aisle?: string;
    shelf?: string;
    bin?: string;
    name?: string;
    [k: string]: unknown;
}
export interface PrintJob {
    id: string;
    job_type: PrintJobType;
    label_type: string;
    reference: string;
    facility: string;
    quantity: number;
    labels?: PrintLabelPayload[];
    created_by: string | null;
    created_at: string;
    reprint_count: number;
    last_reprinted_at: string | null;
    last_reprinted_by: string | null;
    last_reprint_reason: string;
}
/** Fpick: record a print job (the labels just sent to the printer). */
export declare function recordPrintJob(data: {
    job_type?: PrintJobType;
    label_type?: string;
    reference?: string;
    facility?: string;
    labels: PrintLabelPayload[];
    quantity?: number;
}): Promise<PrintJob>;
/** FOS manager: recent print jobs to reprint from. */
export declare function getRecentPrintJobs(params?: {
    limit?: number;
    type?: PrintJobType;
}): Promise<{
    jobs: PrintJob[];
}>;
/** FOS manager: record a reprint (with why) and get back the stored labels to
 * print. `reason` is required by the backend — a missed label print is an
 * operational miss worth a record of why it recurred. */
export declare function reprintJob(id: string, reason: string): Promise<PrintJob>;
/** FOS manager: find ONE pack's stored label by its barcode/serial — for a pack
 * whose sticker is lost and whose print job is no longer in the recent list.
 * Returns the exact label payload + its parent job (call reprintJob(job.id, …)
 * afterwards to record the reprint). Throws 404 if the barcode was never printed. */
export declare function getLabelByBarcode(barcode: string): Promise<{
    label: PrintLabelPayload;
    job: PrintJob;
}>;
/** One rack of a print run, and which of its packs went there. */
export interface PrintJobPlacement {
    id: string;
    location: {
        id: string;
        code: string;
        name: string;
        is_active: boolean;
    };
    barcodes: string[];
    quantity: number;
    placed_by: string | null;
    placed_at: string;
}
export interface PrintJobPlacements {
    job: PrintJob;
    placements: PrintJobPlacement[];
    /** The run's labels not yet on any rack — what the packer is still holding. */
    unplaced: string[];
}
/**
 * Where this print run's packs were put.
 *
 * Read this when a screen (re)opens a job — after a reprint, or a back-out and
 * back in — so the mapping is restored rather than starting blank. It is stored
 * server-side precisely so a reprint can't lose it: a reprint replays the same
 * job's same labels, so the placement still applies.
 */
export declare function getPrintJobPlacements(jobId: string): Promise<PrintJobPlacements>;
/**
 * Put packs on a rack. `location` is the scanned H-Aisle-Shelf-Bin code (or a
 * Location id).
 *
 * Re-posting a rack merges into it; a pack already on a different rack of this
 * job MOVES (returned in `moved`) — a packet is in exactly one place. An unknown
 * or retired rack, or a barcode this job never printed, is refused.
 */
export declare function placePrintJobPacks(jobId: string, data: {
    location_code?: string;
    location_id?: string;
    barcodes: string[];
}): Promise<{
    placement: PrintJobPlacement;
    moved: string[];
    unplaced: string[];
}>;
//# sourceMappingURL=printjobs.d.ts.map