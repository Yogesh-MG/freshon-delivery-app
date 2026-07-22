/**
 * Supported label media configurations.
 *
 *  - `50x30-single`  — 50×30 mm, single column (one label per feed)
 *  - `50x30-double`  — 105 mm liner with two 50×30 columns
 *                       |2.5mm| 50mm | 50mm |2.5mm|
 *  - `50x50-single`  — 50×50 mm, single column
 *  - `50x50-double`  — 105 mm liner with two 50×50 columns
 *                       |2.5mm| 50mm | 50mm |2.5mm|
 */
export type LabelMedia = "50x30-single" | "50x30-double" | "50x50-single" | "50x50-double";
/** Human-readable descriptions for each LabelMedia value. */
export declare const LABEL_MEDIA_OPTIONS: {
    value: LabelMedia;
    label: string;
    desc: string;
}[];
export interface PrinterConfig {
    ip: string;
    port: number;
    type: "network" | "bluetooth" | "system";
    bleName?: string;
    labelMedia: LabelMedia;
}
export interface PrinterHealthResult {
    alive: boolean;
    ip: string;
    port: number;
    type: string;
}
/** Get the active label-media setting from localStorage. */
export declare function getLabelMedia(): LabelMedia;
/** Persist the label-media choice. */
export declare function saveLabelMedia(media: LabelMedia): void;
/** Get printer configuration from localStorage. */
export declare function getPrinterConfig(): PrinterConfig;
/** Save printer configuration to localStorage. */
export declare function savePrinterConfig(config: Partial<PrinterConfig>): void;
/** Public product-QR base. A consumer's camera opens this URL; the in-house
 * scanner strips it back to the raw serial. Kept in sync with Fpick's barcode.ts. */
export declare const PRODUCT_QR_BASE_URL = "https://freshon.in/q/";
/** Wrap a product serial as the public QR URL printed on the label. */
export declare function buildProductQrUrl(serial: string): string;
/**
 * Turn Product.shelf_life_days into the label's Best Before line — a DURATION
 * ("5 Days", "6 Months"), read relative to the "Pkd" date printed beside it, so
 * no per-batch expiry date is needed. Whole months/years read better than a raw
 * day count once they divide evenly (180 → "6 Months", 5 → "5 Days").
 *
 * Returns "" when there's no shelf life on the product — the builders collapse
 * the line rather than printing a guess.
 */
export declare function formatShelfLife(days: number | string | null | undefined): string;
export interface ProductLabelParams {
    productName: string;
    unit: string;
    batchId: string;
    barcode: string;
    mrp?: number | string;
    packedOn?: string;
    bestBefore?: string;
    width?: number;
    height?: number;
}
/**
 * Format a retail product label as TSPL (single 50 × 50 mm thermal sticker).
 * The QR encodes https://freshon.in/q/<serial>. Extra fields (mrp / packedOn /
 * bestBefore) are optional — omitted lines collapse, so older callers keep working.
 */
export declare function formatProductLabelTSPL(params: ProductLabelParams): string;
/**
 * Two-up product labels for 50 × 50 media that carries TWO label columns across
 * the liner ( | label | label | ). Each form is one full-width sheet holding two
 * DIFFERENT labels — left = labels[i], right = labels[i+1] shifted one column
 * right — so a batch fills both columns. An odd final label prints left-only.
 *
 * `gapMm` is the horizontal gap between the two columns (0 = butted, the default
 * for our current stock). Returns ceil(N/2) TSPL forms.
 */
export declare function formatProductLabelsTSPL2Up(labels: ProductLabelParams[], opts?: {
    gapMm?: number;
}): string[];
/**
 * Format retail product labels as raw bytes. This automatically adapts to the selected
 * label media config (50x30 or 50x50, 1-Up or 2-Up) and embeds the raster brand logo
 * bitmap on the 50x50 layouts.
 */
export declare function formatProductLabelsTSPLBytes(labels: ProductLabelParams[], opts?: {
    gapMm?: number;
}): Promise<number[]>;
/**
 * Build a warehouse CRATE label (TSPL, 50 × 50 mm thermal sticker).
 *
 * The QR encodes the RAW `P-<batchPrefix>` value (NOT a URL) so the warehouse
 * mapping wizard's camera scanner — which expects a `P-` prefix — reads it back
 * directly. Uses QR Model 2 (M2,S7); Model 1 can't be scanned by phones.
 */
export interface CrateLabelParams {
    product: string;
    batchPrefix: string;
    barcode: string;
    crate: number;
    totalCrates: number;
    farmName?: string;
    width?: number;
    height?: number;
}
/**
 * Build a warehouse CRATE label (TSPL, single 50 × 50 mm thermal sticker).
 *
 * The QR encodes the RAW `P-<batchPrefix>` value (NOT a URL) so the warehouse
 * mapping wizard's camera scanner — which expects a `P-` prefix — reads it back
 * directly. Uses QR Model 2 (M2,S7); Model 1 can't be scanned by phones.
 */
export declare function formatCrateLabelTSPL(params: CrateLabelParams): string;
/**
 * Build crate labels for the CONFIGURED media — the entry point crate callers
 * should use, the crate twin of formatLocationLabelsTSPL. Returns one TSPL form
 * per sheet, reading getLabelMedia() to pick 50 × 30 vs 50 × 50 and single vs
 * two-up. This is what makes a crate print correctly on whatever roll the hub
 * has loaded, instead of the caller hard-coding one size.
 *
 * On two-up media a thermal printer has no horizontal column awareness, so the
 * whole 102.5 mm sheet is authored at once: left column at dx=20 (the 2.5 mm
 * liner margin), right at dx=420 — geometry identical to the live product and
 * location paths. An odd final crate prints left-column-only on a full sheet.
 */
export declare function formatCrateLabelsTSPL(crates: CrateLabelParams[], opts?: {
    gapMm?: number;
}): string[];
/**
 * Two-up crate labels for 50 × 50 media with two columns across the liner.
 * Left = crates[i], right = crates[i+1] one column over. `gapMm` = horizontal
 * gap between columns (0 = butted). Returns ceil(N/2) TSPL forms.
 */
export declare function formatCrateLabelsTSPL2Up(crates: CrateLabelParams[], opts?: {
    gapMm?: number;
}): string[];
export interface LocationLabelParams {
    /** The scannable code, e.g. "H-A1-S2-B3" — encoded RAW in the QR. */
    code: string;
    aisle: string;
    shelf: string;
    bin: string;
    /** Optional human name for the shelf, e.g. "Leafy greens". */
    name?: string;
    width?: number;
    height?: number;
}
/**
 * Build ONE shelf label as a single sticker. Defaults to 50 × 50; pass
 * `height: 30` for the 30 mm roll. For a batch — and for TWO-UP media — use
 * formatLocationLabelsTSPL, which reads the configured media.
 */
export declare function formatLocationLabelTSPL(params: LocationLabelParams): string;
/**
 * Build shelf labels for the CONFIGURED media — the entry point every caller
 * should use. Returns one TSPL form per sheet.
 *
 * On two-up media this is the only correct way to print. A thermal printer has
 * no horizontal column awareness: it senses gaps vertically for feed and
 * otherwise lays the bitmap at its origin. So a `SIZE 50` design on the 105 mm
 * two-up liner does NOT fill the left column — it straddles the seam, half on
 * one sticker and half on the next. The fix is to author the whole sheet:
 * `SIZE 102.5`, left column at dx=20 (the 2.5 mm liner margin) and right at
 * dx=420. Geometry matches formatProductLabelsTSPLBytes, the live product path.
 *
 * An odd final label prints left-column-only on a full-width sheet.
 * Two-up needs a 4-inch (104 mm) head.
 */
export declare function formatLocationLabelsTSPL(locations: LocationLabelParams[], opts?: {
    gapMm?: number;
}): string[];
/**
 * Build a shipping ADDRESS label (TSPL) for an out-of-radius / courier parcel.
 * Defaults to a 100×150 mm (4×6") label.
 */
export declare function formatShippingAddressLabelTSPL(params: {
    trackingId: string;
    name: string;
    phone?: string;
    address: string;
    courier?: string;
    waybill?: string;
    width?: number;
    height?: number;
}): string;
/**
 * Build an ingestion TASK SLIP (TSPL) — printed by a FOS manager when
 * assigning a batch-packing task to a specific employee (see
 * apps/inventory IngestionAssignment). Text-only work order, not a barcode
 * sticker: the employee carries this to the hub and fulfills it in
 * Fpick_app's Packet Ingestion screen. 50 × 30 mm — the project's standard
 * single-label media (see printer-two-up-50x50 project notes).
 */
export interface IngestionTaskSlipParams {
    productName: string;
    variantUnit: string;
    batchId: string;
    packetCount: number;
    assignedTo: string;
    assignedBy?: string;
    assignedAt?: string;
    width?: number;
    height?: number;
}
export declare function formatIngestionTaskSlipTSPL(params: IngestionTaskSlipParams): string;
interface LogoBitmap {
    /** Rendered width in dots. */
    width: number;
    /** Row width in BYTES (TSPL BITMAP expects width in bytes, not dots). */
    widthBytes: number;
    /** Height in dots. */
    height: number;
    /** Packed 1-bit data, row-major, MSB-first, 1 = white / 0 = black. */
    data: number[];
}
/**
 * Rasterise the shared brand logo to a TSPL bitmap, scaled to fit inside a
 * `maxWidthDots` × `maxHeightDots` box (aspect preserved, never upscaled — the
 * source art is 666 × 375). Returns null if it can't be loaded/processed, so
 * callers fall back to a text header. Cached per box size (per page load) so
 * repeated prints are cheap.
 */
export declare function getLogoBitmap(maxWidthDots?: number, maxHeightDots?: number): Promise<LogoBitmap | null>;
/** One delivery-handover bag label — one per bag in a multi-bag order. Stored
 * verbatim in PrintJob.labels so a reprint rebuilds byte-identically even if
 * the order's data has since changed. */
export interface HandoverLabelParams {
    /** Order tracking id, shown below the QR (e.g. "FRSH-A1B2C3"). */
    trackingId: string;
    /** 1-based bag number, e.g. 2 of 3. */
    bagIndex: number;
    totalBags: number;
    /** The short per-bag code already assigned at print time (e.g. "D-XXXX-1") —
     * the QR encodes buildProductQrUrl(bagCode), not the trackingId. */
    bagCode: string;
}
/**
 * Build ONE combined TSPL byte stream for every bag of a delivery handover —
 * a large brand logo on the left, a phone-scannable QR on the right, the
 * tracking id + bag index below the QR. 50 × 30 mm thermal stock.
 *
 * Returns raw bytes (not a string) because the logo is embedded as a TSPL
 * `BITMAP` command with a binary payload.
 */
export declare function formatHandoverLabelsTSPLBytes(bags: HandoverLabelParams[]): Promise<number[]>;
export {};
//# sourceMappingURL=printer.d.ts.map