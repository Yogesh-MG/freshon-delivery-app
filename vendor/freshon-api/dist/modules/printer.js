// packages/freshon-api/src/modules/printer.ts
// Shared thermal-label code for the Tauri desktop apps (Fpick warehouse + FOS).
//
// This module is intentionally PURE — config (localStorage) + TSPL label
// builders only, NO Tauri. That keeps every app printing byte-identical labels
// without coupling this package to a host runtime. The actual print TRANSPORT
// (printLabel/printLabels via the Tauri `invoke` bridge) lives in each app,
// since it binds to that app's registered Tauri commands.
//
// The handover-label builder is the one exception to "no binary payloads": it
// rasterises the brand logo into the TSPL BITMAP command, so it returns raw
// bytes (number[]) instead of a TSPL string — a UTF-8 string encode would
// corrupt any byte > 0x7F. It's still PURE (Canvas/Image are browser APIs
// available in every Tauri webview, no Tauri import needed).
import { logoPrintUrl } from "../branding";
/** Human-readable descriptions for each LabelMedia value. */
export const LABEL_MEDIA_OPTIONS = [
    { value: "50x30-single", label: "50×30 Single Roll", desc: "Single column · 50 mm wide" },
    { value: "50x30-double", label: "50×30 Double Roll (105mm)", desc: "2-Up · |2.5mm| 50mm | 50mm |2.5mm|" },
    { value: "50x50-single", label: "50×50 Single Roll", desc: "Single column · 50 mm wide" },
    { value: "50x50-double", label: "50×50 Double Roll (105mm)", desc: "2-Up · |2.5mm| 50mm | 50mm |2.5mm|" },
];
const DEFAULT_PRINTER_IP = "192.168.68.112";
const DEFAULT_PRINTER_PORT = 9100;
const DEFAULT_PRINTER_TYPE = "network";
const DEFAULT_BLE_NAME = "Thermal Printer";
const DEFAULT_LABEL_MEDIA = "50x30-single";
/** Get the active label-media setting from localStorage. */
export function getLabelMedia() {
    return localStorage.getItem("picker_label_media") || DEFAULT_LABEL_MEDIA;
}
/** Persist the label-media choice. */
export function saveLabelMedia(media) {
    localStorage.setItem("picker_label_media", media);
}
/** Get printer configuration from localStorage. */
export function getPrinterConfig() {
    return {
        ip: localStorage.getItem("picker_printer_ip") || DEFAULT_PRINTER_IP,
        port: parseInt(localStorage.getItem("picker_printer_port") || "", 10) || DEFAULT_PRINTER_PORT,
        type: localStorage.getItem("picker_printer_type") || DEFAULT_PRINTER_TYPE,
        bleName: localStorage.getItem("picker_printer_ble_name") || DEFAULT_BLE_NAME,
        labelMedia: getLabelMedia(),
    };
}
/** Save printer configuration to localStorage. */
export function savePrinterConfig(config) {
    if (config.ip !== undefined)
        localStorage.setItem("picker_printer_ip", config.ip);
    if (config.port !== undefined)
        localStorage.setItem("picker_printer_port", config.port.toString());
    if (config.type !== undefined)
        localStorage.setItem("picker_printer_type", config.type);
    if (config.bleName !== undefined)
        localStorage.setItem("picker_printer_ble_name", config.bleName);
    if (config.labelMedia !== undefined)
        saveLabelMedia(config.labelMedia);
}
// ─── Label builders (pure) ──────────────────────────────────────────────────────
/** Public product-QR base. A consumer's camera opens this URL; the in-house
 * scanner strips it back to the raw serial. Kept in sync with Fpick's barcode.ts. */
export const PRODUCT_QR_BASE_URL = "https://freshon.in/q/";
/** Wrap a product serial as the public QR URL printed on the label. */
export function buildProductQrUrl(serial) {
    return `${PRODUCT_QR_BASE_URL}${encodeURIComponent(serial.trim())}`;
}
/** Sanitise a value for inclusion in a TSPL TEXT command (escape quotes). */
function tsplText(value, fallback = "") {
    const s = (value === undefined || value === null ? fallback : String(value)).trim();
    return s.replace(/"/g, "'");
}
/**
 * Unit selling price (Usp): the MRP normalised to a base unit (per g/ml/pc) so
 * customers can compare value across pack sizes. Returns "" when it can't be
 * computed (no price, or a unit with no parseable quantity).
 */
function computeUsp(unit, mrp) {
    const price = typeof mrp === "number" ? mrp : parseFloat(String(mrp ?? ""));
    if (!price || !isFinite(price))
        return "";
    const m = String(unit ?? "").trim().toLowerCase()
        .match(/([\d.]+)\s*(kg|kgs|g|gm|gms|gram|grams|ml|l|ltr|litre|liter|liters|litres|pc|pcs|piece|pieces|nos?|u|unit|units)?/);
    if (!m)
        return "";
    let qty = parseFloat(m[1]);
    if (!qty || !isFinite(qty))
        return "";
    const u = m[2] || "";
    let base;
    if (u === "kg" || u === "kgs") {
        qty *= 1000;
        base = "g";
    }
    else if (u === "g" || u === "gm" || u === "gms" || u === "gram" || u === "grams") {
        base = "g";
    }
    else if (u === "l" || u === "ltr" || u === "litre" || u === "liter" || u === "liters" || u === "litres") {
        qty *= 1000;
        base = "ml";
    }
    else if (u === "ml") {
        base = "ml";
    }
    else {
        base = "pc";
    }
    const per = price / qty;
    const val = base === "pc" ? String(Math.round(per)) : per.toFixed(2);
    return `Rs.${val}/${base}`;
}
/**
 * Turn Product.shelf_life_days into the label's Best Before line — a DURATION
 * ("5 Days", "6 Months"), read relative to the "Pkd" date printed beside it, so
 * no per-batch expiry date is needed. Whole months/years read better than a raw
 * day count once they divide evenly (180 → "6 Months", 5 → "5 Days").
 *
 * Returns "" when there's no shelf life on the product — the builders collapse
 * the line rather than printing a guess.
 */
export function formatShelfLife(days) {
    const n = typeof days === "number" ? days : parseInt(String(days ?? ""), 10);
    if (!n || !isFinite(n) || n <= 0)
        return "";
    const plural = (v, unit) => `${v} ${unit}${v === 1 ? "" : "s"}`;
    if (n % 365 === 0)
        return plural(n / 365, "Year");
    if (n % 30 === 0)
        return plural(n / 30, "Month");
    return plural(n, "Day");
}
/**
 * The drawing commands for ONE product label, shifted right by `dx` dots.
 * No SIZE/GAP/CLS/PRINT wrapper — so a form can compose one (single) or two
 * (two-up) of these. The 50 mm column is 400 dots wide (8 dots/mm @ 203 dpi).
 */
function productLabelBody(params, dx) {
    const { productName, unit, barcode, mrp, packedOn, bestBefore } = params;
    const name = tsplText(productName, "PRODUCT")
        .toUpperCase()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 1)
        .join(" ")
        .slice(0, 5);
    const netWt = tsplText(unit, "N/A");
    const mrpVal = mrp !== undefined && mrp !== "" ? `Rs.${tsplText(mrp)}` : "";
    const pkdVal = packedOn ? tsplText(packedOn) : "";
    const bbVal = bestBefore ? tsplText(bestBefore) : "";
    const uspVal = computeUsp(unit, mrp);
    const qrUrl = tsplText(buildProductQrUrl(barcode));
    const x = (v) => v + dx; // shift every X into this column
    let body = `TEXT ${x(18)},15,"3",0,1,1,"${name}"\r\n` +
        `TEXT ${x(104)},18,"2",0,1,1,"${tsplText(barcode)}"\r\n` +
        `BAR ${x(16)},46,354,2\r\n` +
        `TEXT ${x(16)},58,"2",0,1,1,"Net Wt:"\r\n` +
        `TEXT ${x(114)},58,"2",0,1,1,"${netWt}"\r\n`;
    if (mrpVal)
        body += `TEXT ${x(16)},84,"2",0,1,1,"MRP:"\r\n` + `TEXT ${x(70)},84,"2",0,1,1,"${mrpVal}"\r\n`;
    if (pkdVal)
        body += `TEXT ${x(16)},111,"2",0,1,1,"Pkd:"\r\n` + `TEXT ${x(69)},112,"2",0,1,1,"${pkdVal}"\r\n`;
    if (uspVal)
        body += `TEXT ${x(16)},139,"2",0,1,1,"Usp:"\r\n` + `TEXT ${x(73)},140,"2",0,1,1,"${uspVal}"\r\n`;
    // Best Before drops BELOW the QR (which ends ~y174) so it gets the full width:
    // the label at font "2" and the date itself at the larger font "3" for readability.
    if (bbVal)
        body += `TEXT ${x(16)},182,"2",0,1,1,"Best Before:"\r\n` + `TEXT ${x(174)},178,"3",0,1,1,"${bbVal}"\r\n`;
    body += `QRCODE ${x(237)},58,L,4,A,0,M2,S7,"${qrUrl}"\r\n`;
    return body;
}
/**
 * Format a retail product label as TSPL (single 50 × 50 mm thermal sticker).
 * The QR encodes https://freshon.in/q/<serial>. Extra fields (mrp / packedOn /
 * bestBefore) are optional — omitted lines collapse, so older callers keep working.
 */
export function formatProductLabelTSPL(params) {
    const { width = 50, height = 50 } = params;
    return (`SIZE ${width} mm, ${height} mm\r\n` +
        `GAP 3 mm, 0\r\n` +
        `DIRECTION 1\r\n` +
        `SET TEAR ON\r\n` +
        `CLS\r\n` +
        productLabelBody(params, 0) +
        `PRINT 1\r\n`);
}
/**
 * Two-up product labels for 50 × 50 media that carries TWO label columns across
 * the liner ( | label | label | ). Each form is one full-width sheet holding two
 * DIFFERENT labels — left = labels[i], right = labels[i+1] shifted one column
 * right — so a batch fills both columns. An odd final label prints left-only.
 *
 * `gapMm` is the horizontal gap between the two columns (0 = butted, the default
 * for our current stock). Returns ceil(N/2) TSPL forms.
 */
export function formatProductLabelsTSPL2Up(labels, opts = {}) {
    const width = labels[0]?.width ?? 50;
    const height = labels[0]?.height ?? 50;
    const gapMm = opts.gapMm ?? 0;
    const pitchDots = (width + gapMm) * 8; // left edge of the right column
    const sheetWidthMm = width * 2 + gapMm; // full media width
    const forms = [];
    for (let i = 0; i < labels.length; i += 2) {
        let cmd = `SIZE ${sheetWidthMm} mm, ${height} mm\r\n` +
            `GAP 3 mm, 0\r\n` +
            `DIRECTION 1\r\n` +
            `SET TEAR ON\r\n` +
            `CLS\r\n` +
            productLabelBody(labels[i], 0);
        if (labels[i + 1])
            cmd += productLabelBody(labels[i + 1], pitchDots);
        cmd += `PRINT 1\r\n`;
        forms.push(cmd);
    }
    return forms;
}
/**
 * Format retail product labels as raw bytes. This automatically adapts to the selected
 * label media config (50x30 or 50x50, 1-Up or 2-Up) and embeds the raster brand logo
 * bitmap on the 50x50 layouts.
 */
export async function formatProductLabelsTSPLBytes(labels, opts = {}) {
    const media = getLabelMedia();
    const isDouble = media.includes("double");
    const is50 = media.includes("50x50");
    const enc = new TextEncoder();
    const out = [];
    const push = (s) => { for (const b of enc.encode(s))
        out.push(b); };
    // The 50x50 product label lays the logo out in a 100-dot box (see label-preview.html).
    const LOGO_BOX = 100;
    const logo = is50 ? await getLogoBitmap(LOGO_BOX, LOGO_BOX) : null;
    const width = 50;
    const height = is50 ? 50 : 30;
    const gapMm = opts.gapMm ?? 0;
    const pitchDots = (width + gapMm) * 8; // 400 dots
    const sheetWidthMm = isDouble ? 102.5 : width; // 102.5 mm width for 2-Up backing
    const dxL = isDouble ? 20 : 0;
    const dxR = isDouble ? 420 : 0;
    const appendProductLabelBody = (label, dx) => {
        const { productName, unit, barcode, mrp, packedOn, bestBefore } = label;
        const qrUrl = tsplText(buildProductQrUrl(barcode));
        if (is50) {
            // Font "2" nominally a 12-dot cell, but glyphs print a touch wider, so 30
            // chars from x+16 reached ~x+426 and bled into the RIGHT 2-up column ("printed
            // onto the next sticker"). Cap to a width that stays inside this column (start
            // 36 + 26×~14 ≈ 400 < the 420 pitch) and add an ellipsis, so a long name is cut
            // to what one sticker holds instead of overflowing.
            // ASCII "..." not "…": the printer's internal font has no ellipsis glyph
            // and would print a box.
            const NAME_MAX = 26;
            const rawName = tsplText(productName, "PRODUCT").toUpperCase();
            const name = rawName.length > NAME_MAX ? rawName.slice(0, NAME_MAX - 3) + "..." : rawName;
            const netWt = tsplText(unit, "N/A");
            const mrpVal = mrp !== undefined && mrp !== "" ? `Rs.${tsplText(mrp)}` : "";
            const pkdVal = packedOn ? tsplText(packedOn) : "";
            const bbVal = bestBefore ? tsplText(bestBefore) : "";
            const uspVal = computeUsp(unit, mrp);
            if (logo) {
                push(logoBitmapCommand(logo, dx + 120, 0, LOGO_BOX));
                for (const b of logo.data)
                    out.push(b);
                push(`\r\n`);
            }
            else {
                // The raster failed (asset blocked/unreadable). Print the wordmark as text
                // rather than shipping an unbranded label — and so the failure is visible.
                push(`TEXT ${dx + 130},30,"3",0,1,1,"FRESHON.IN"\r\n`);
            }
            push(`BAR ${dx + 16},80,368,2\r\n`);
            push(`TEXT ${dx + 16},95,"2",0,1,1,"${name}"\r\n`);
            // The serial sits BELOW the Best Before row rather than beside the name, so
            // the name gets the full row width. Left-shifted well clear of the column's
            // right edge: a 15-char serial at font "1" (8-dot cell) is 120 dots, so
            // starting at 165 ends at ~285 — inside the 400-dot column even for a long
            // serial. Starting it under the QR's left edge (245) ran the tail off the
            // edge and clipped the last characters.
            push(`TEXT ${dx + 165},280,"1",0,1,1,"${tsplText(barcode)}"\r\n`);
            push(`TEXT ${dx + 16},135,"2",0,1,1,"Net Wt:"\r\n`);
            push(`TEXT ${dx + 114},135,"2",0,1,1,"${netWt}"\r\n`);
            if (mrpVal) {
                push(`TEXT ${dx + 16},165,"2",0,1,1,"MRP:"\r\n`);
                push(`TEXT ${dx + 70},165,"2",0,1,1,"${mrpVal}"\r\n`);
            }
            if (pkdVal) {
                push(`TEXT ${dx + 16},195,"2",0,1,1,"Pkd:"\r\n`);
                push(`TEXT ${dx + 69},195,"2",0,1,1,"${pkdVal}"\r\n`);
            }
            if (uspVal) {
                push(`TEXT ${dx + 16},225,"2",0,1,1,"Usp:"\r\n`);
                push(`TEXT ${dx + 73},225,"2",0,1,1,"${uspVal}"\r\n`);
            }
            // Best Before sits just under the QR (which ends ~y250) at font "2" — it must
            // clear the footer divider at y302.
            if (bbVal) {
                push(`TEXT ${dx + 16},256,"2",0,1,1,"Best Before:"\r\n`);
                // Value nudged right (was +173) so it clears "Best Before:" with a clear gap
                // instead of sitting right up against the colon.
                push(`TEXT ${dx + 197},256,"2",0,1,1,"${bbVal}"\r\n`);
            }
            push(`QRCODE ${dx + 245},135,L,4,A,0,M2,S7,"${qrUrl}"\r\n`);
            push(`BAR ${dx + 16},302,368,1\r\n`);
            push(`TEXT ${dx + 116},311,"1",0,1,1,"fssai: 11222332000572"\r\n`);
            push(`TEXT ${dx + 34},326,"1",0,1,1,"Care: 8088080909 | care@freshon.in"\r\n`);
            push(`TEXT ${dx + 5},344,"1",0,1,1,"ELITECK Solutions And Services Pvt Ltd."\r\n`);
            push(`TEXT ${dx + 11},359,"1",0,1,1,"#17, 80ft Ring Road, Mallathahalli,"\r\n`);
            push(`TEXT ${dx + 109},374,"1",0,1,1,"B'luru-560056"\r\n`);
        }
        else {
            push(productLabelBody(label, dx));
        }
    };
    if (isDouble) {
        for (let i = 0; i < labels.length; i += 2) {
            push(`SIZE ${sheetWidthMm} mm, ${height} mm\r\n`);
            push(`GAP 3 mm, 0\r\n`);
            push(`DIRECTION 1\r\n`);
            push(`SET TEAR ON\r\n`);
            push(`CLS\r\n`);
            appendProductLabelBody(labels[i], dxL);
            if (labels[i + 1]) {
                appendProductLabelBody(labels[i + 1], dxR);
            }
            push(`PRINT 1\r\n`);
        }
    }
    else {
        for (const label of labels) {
            push(`SIZE ${width} mm, ${height} mm\r\n`);
            push(`GAP 3 mm, 0\r\n`);
            push(`DIRECTION 1\r\n`);
            push(`SET TEAR ON\r\n`);
            push(`CLS\r\n`);
            appendProductLabelBody(label, 0);
            push(`PRINT 1\r\n`);
        }
    }
    return out;
}
/**
 * Drawing commands for ONE crate label, shifted right by `dx` dots.
 *
 * `is50` picks the layout for the loaded media, the same way locationLabelBody
 * does — a 50 × 30 crate has no room for the tall scan-first design:
 *  - 50 × 30 (240 dots): compact — name row up top, batch / crate-of / farm
 *    stacked at the left, QR beside them on the right.
 *  - 50 × 50 (400 dots): scan-first — name across the top, a large cell-7 QR in
 *    the upper middle (a crate is read across the room, so the QR is the hero),
 *    and the batch / crate-of / farm identity along the foot. Authored in
 *    Fpick_app/label-preview.html and exported 2026-07-21.
 */
function crateLabelBody(params, dx, is50) {
    const { product, batchPrefix, barcode, crate, totalCrates, farmName } = params;
    const name = tsplText(product, "PRODUCT").toUpperCase();
    const qrData = tsplText(barcode);
    const x = (v) => v + dx;
    if (!is50) {
        let body = `BLOCK ${x(16)},14,224,64,"3",0,1,1,"${name}"\r\n` +
            `TEXT ${x(16)},86,"2",0,1,1,"Batch:${tsplText(batchPrefix)}"\r\n` +
            `TEXT ${x(16)},116,"2",0,1,1,"Crate ${crate}/${totalCrates}"\r\n`;
        if (farmName)
            body += `TEXT ${x(16)},146,"1",0,1,1,"${tsplText(farmName)}"\r\n`;
        body += `QRCODE ${x(252)},64,L,4,A,0,M2,S7,"${qrData}"\r\n`;
        return body;
    }
    let body = `BLOCK ${x(16)},26,224,64,"3",0,1,1,"${name}"\r\n` +
        `QRCODE ${x(91)},99,L,7,A,0,M2,S7,"${qrData}"\r\n` +
        `TEXT ${x(40)},290,"2",0,1,1,"Batch:${tsplText(batchPrefix)}"\r\n` +
        `TEXT ${x(40)},328,"2",0,1,1,"Crate ${crate}/${totalCrates}"\r\n`;
    if (farmName)
        body += `TEXT ${x(36)},362,"1",0,1,1,"${tsplText(farmName)}"\r\n`;
    return body;
}
/**
 * Build a warehouse CRATE label (TSPL, single 50 × 50 mm thermal sticker).
 *
 * The QR encodes the RAW `P-<batchPrefix>` value (NOT a URL) so the warehouse
 * mapping wizard's camera scanner — which expects a `P-` prefix — reads it back
 * directly. Uses QR Model 2 (M2,S7); Model 1 can't be scanned by phones.
 */
export function formatCrateLabelTSPL(params) {
    const { width = 50, height = 50 } = params;
    return (`SIZE ${width} mm, ${height} mm\r\n` +
        `GAP 3 mm, 0\r\n` +
        `DIRECTION 1\r\n` +
        `SET TEAR ON\r\n` +
        `CLS\r\n` +
        crateLabelBody(params, 0, height >= 50) +
        `PRINT 1\r\n`);
}
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
export function formatCrateLabelsTSPL(crates, opts = {}) {
    const media = getLabelMedia();
    const isDouble = media.includes("double");
    const is50 = media.includes("50x50");
    const height = is50 ? 50 : 30;
    const gapMm = opts.gapMm ?? 0;
    const sheetWidthMm = isDouble ? 102.5 + gapMm : 50;
    const dxL = isDouble ? 20 : 0;
    const dxR = dxL + (50 + gapMm) * 8;
    const forms = [];
    const step = isDouble ? 2 : 1;
    for (let i = 0; i < crates.length; i += step) {
        let cmd = `SIZE ${sheetWidthMm} mm, ${height} mm\r\n` +
            `GAP 3 mm, 0\r\n` +
            `DIRECTION 1\r\n` +
            `SET TEAR ON\r\n` +
            `CLS\r\n` +
            crateLabelBody(crates[i], dxL, is50);
        if (isDouble && crates[i + 1]) {
            cmd += crateLabelBody(crates[i + 1], dxR, is50);
        }
        cmd += `PRINT 1\r\n`;
        forms.push(cmd);
    }
    return forms;
}
/**
 * Two-up crate labels for 50 × 50 media with two columns across the liner.
 * Left = crates[i], right = crates[i+1] one column over. `gapMm` = horizontal
 * gap between columns (0 = butted). Returns ceil(N/2) TSPL forms.
 */
export function formatCrateLabelsTSPL2Up(crates, opts = {}) {
    const width = crates[0]?.width ?? 50;
    const height = crates[0]?.height ?? 50;
    const gapMm = opts.gapMm ?? 0;
    const pitchDots = (width + gapMm) * 8;
    const sheetWidthMm = width * 2 + gapMm;
    const forms = [];
    for (let i = 0; i < crates.length; i += 2) {
        let cmd = `SIZE ${sheetWidthMm} mm, ${height} mm\r\n` +
            `GAP 3 mm, 0\r\n` +
            `DIRECTION 1\r\n` +
            `SET TEAR ON\r\n` +
            `CLS\r\n` +
            crateLabelBody(crates[i], 0, true);
        if (crates[i + 1])
            cmd += crateLabelBody(crates[i + 1], pitchDots, true);
        cmd += `PRINT 1\r\n`;
        forms.push(cmd);
    }
    return forms;
}
// Printed glyph widths, MEASURED not nominal. The TSC internal fonts lay down
// about 1.14× their nominal cell: font "2" (nominal 12) measured ~14 when 30
// chars from x+16 reached x+426 and bled onto the next sticker — the finding
// that forced the product label's 26-char name cap. Font "4" (nominal 24) scales
// the same. Anything positioned off these must stay inside the 400-dot column.
const FONT2_DOTS = 14;
const FONT4_DOTS = 27;
/** Right-hand text margin inside a 400-dot column (mirrors the 16-dot left one). */
const TEXT_RIGHT = 384;
/**
 * Drawing commands for ONE shelf label, shifted right by `dx` dots.
 *
 * The QR encodes the RAW `H-<aisle>-<shelf>-<bin>` code (NOT a URL), the same
 * choice the crate label makes: the hub scanner reads the code back directly and
 * resolves it against the Location grid. QR Model 2 (M2,S7) — Model 1 can't be
 * scanned by phones. TSPL's ECC level is UNQUOTED (`L,4`, not `"L",4`).
 *
 * Layout is driven by what a picker does with it: they read the rack from a
 * couple of metres away, so aisle+shelf is the hero line and the bin gets its
 * own, both at font "4". The full code repeats small at the bottom for when
 * someone reads or types one out.
 *
 * Nothing may cross this column's 400-dot edge — on two-up media that lands on
 * the NEXT sticker. The hero is safe by construction: segments cap at 4 chars
 * (barcodes.py::_LOC_SEGMENT), so "AAAA-SSSS" is 9 glyphs, and font "4" prints
 * nearer 28 dots than its nominal 24 (the same measurement that forced the
 * product label's 26-char name cap), giving ~268 from x+16. `name` goes in a
 * width-bounded BLOCK so it WRAPS instead of bleeding sideways.
 */
function locationLabelBody(params, dx, is50) {
    const { code, aisle, shelf, bin, name } = params;
    const qrData = tsplText(code);
    const heroText = tsplText(`${aisle}-${shelf}`).toUpperCase();
    const binText = tsplText(`BIN ${bin}`).toUpperCase();
    const x = (v) => v + dx;
    if (!is50) {
        // 50 × 30 (240 dots): compact — QR beside the text. x=252 leaves >=20 dots
        // past the hero's widest end, above the 16 a 4-dot-cell QR needs to lock on.
        let body = `TEXT ${x(16)},16,"4",0,1,1,"${heroText}"\r\n` +
            `TEXT ${x(16)},60,"4",0,1,1,"${binText}"\r\n`;
        if (name)
            body += `BLOCK ${x(16)},104,220,56,"2",0,1,1,"${tsplText(name)}"\r\n`;
        body += `TEXT ${x(16)},206,"1",0,1,1,"${qrData}"\r\n`;
        body += `QRCODE ${x(252)},60,L,4,A,0,M2,S7,"${qrData}"\r\n`;
        return body;
    }
    // 50 × 50 (400 dots) — layout authored in Fpick_app/label-preview.html and
    // exported 2026-07-16. The whole label is the QR: identity on one line at the
    // top, a 23.6 mm code centred beneath it, the raw string at the foot.
    //
    // The product name is deliberately ABSENT here (the 30 mm layout still carries
    // it): a rack sticker is scanned, not read for its contents.
    //
    // Positions are COMPUTED, not frozen from the export, for two reasons: the
    // exported left and right columns had drifted 11-40 dots apart from being
    // dragged separately, and this body is drawn once then shifted by dx — both
    // columns must be identical. Centring reproduces the intent exactly (the QR
    // was placed at 106, which is the centred value to the dot).
    const QR_CELL = 9;
    // ECC L fits 25 alphanumerics in a 21-module version-1 symbol, and the longest
    // code the format can mint is "H-AAAA-SSSS-BBBB" (16 chars, and '-' is in the
    // alphanumeric set), so every shelf code lands in v1. 21 × 9 = 189 dots.
    const QR_DOTS = 21 * QR_CELL;
    const qrX = Math.round((400 - QR_DOTS) / 2);
    const binX = TEXT_RIGHT - binText.length * FONT4_DOTS;
    const codeX = Math.round((400 - qrData.length * FONT2_DOTS) / 2);
    let body = `TEXT ${x(16)},36,"4",0,1,1,"${heroText}"\r\n` +
        // Right-aligned rather than a fixed x: at ~27 dots a glyph, a fixed BIN start
        // runs off the 400-dot column edge and prints onto the NEXT sticker — the
        // failure the product label's 26-char name cap exists to prevent.
        `TEXT ${x(binX)},36,"4",0,1,1,"${binText}"\r\n` +
        `QRCODE ${x(qrX)},108,L,${QR_CELL},A,0,M2,S7,"${qrData}"\r\n` +
        `TEXT ${x(codeX)},346,"2",0,1,1,"${qrData}"\r\n`;
    return body;
}
/**
 * Build ONE shelf label as a single sticker. Defaults to 50 × 50; pass
 * `height: 30` for the 30 mm roll. For a batch — and for TWO-UP media — use
 * formatLocationLabelsTSPL, which reads the configured media.
 */
export function formatLocationLabelTSPL(params) {
    const { width = 50, height = 50 } = params;
    return (`SIZE ${width} mm, ${height} mm\r\n` +
        `GAP 3 mm, 0\r\n` +
        `DIRECTION 1\r\n` +
        `SET TEAR ON\r\n` +
        `CLS\r\n` +
        locationLabelBody(params, 0, height >= 50) +
        `PRINT 1\r\n`);
}
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
export function formatLocationLabelsTSPL(locations, opts = {}) {
    const media = getLabelMedia();
    const isDouble = media.includes("double");
    const is50 = media.includes("50x50");
    const height = is50 ? 50 : 30;
    const gapMm = opts.gapMm ?? 0;
    // 102.5 mm, not 100: the liner is |2.5mm| 50mm | 50mm |2.5mm|, so the left
    // column starts 20 dots in and the right one a 400-dot pitch after it.
    const sheetWidthMm = isDouble ? 102.5 + gapMm : 50;
    const dxL = isDouble ? 20 : 0;
    const dxR = dxL + (50 + gapMm) * 8;
    const forms = [];
    const step = isDouble ? 2 : 1;
    for (let i = 0; i < locations.length; i += step) {
        let cmd = `SIZE ${sheetWidthMm} mm, ${height} mm\r\n` +
            `GAP 3 mm, 0\r\n` +
            `DIRECTION 1\r\n` +
            `SET TEAR ON\r\n` +
            `CLS\r\n` +
            locationLabelBody(locations[i], dxL, is50);
        if (isDouble && locations[i + 1]) {
            cmd += locationLabelBody(locations[i + 1], dxR, is50);
        }
        cmd += `PRINT 1\r\n`;
        forms.push(cmd);
    }
    return forms;
}
/**
 * Build a shipping ADDRESS label (TSPL) for an out-of-radius / courier parcel.
 * Defaults to a 100×150 mm (4×6") label.
 */
export function formatShippingAddressLabelTSPL(params) {
    const { trackingId, name, phone, address, courier, waybill, width = 100, height = 150 } = params;
    const W = width * 8;
    let cmd = `SIZE ${width} mm, ${height} mm\r\n` +
        `GAP 3 mm, 0\r\n` +
        `DIRECTION 1\r\n` +
        `SET TEAR ON\r\n` +
        `CLS\r\n` +
        `TEXT 24,24,"3",0,1,1,"FreshOn"\r\n` +
        `TEXT 24,60,"2",0,1,1,"COURIER PARCEL${courier ? " - " + tsplText(courier) : ""}"\r\n` +
        `BAR 16,96,${W - 32},3\r\n` +
        `TEXT 24,120,"2",0,1,1,"DELIVER TO:"\r\n` +
        `BLOCK 24,150,${W - 48},90,"4",0,1,1,"${tsplText(name)}"\r\n`;
    if (phone)
        cmd += `TEXT 24,250,"3",0,1,1,"Ph: ${tsplText(phone)}"\r\n`;
    cmd += `BLOCK 24,300,${W - 48},360,"3",0,1,1,"${tsplText(address)}"\r\n`;
    cmd += `BAR 16,690,${W - 32},2\r\n`;
    cmd += `TEXT 24,710,"2",0,1,1,"ORDER"\r\n`;
    cmd += `TEXT 24,740,"4",0,1,1,"${tsplText(trackingId)}"\r\n`;
    if (waybill) {
        cmd += `TEXT 24,830,"2",0,1,1,"${tsplText(courier || "Courier")} AWB: ${tsplText(waybill)}"\r\n`;
        cmd += `BARCODE 24,870,"128",120,1,0,2,2,"${tsplText(waybill)}"\r\n`;
    }
    cmd += `PRINT 1\r\n`;
    return cmd;
}
export function formatIngestionTaskSlipTSPL(params) {
    const { productName, variantUnit, batchId, packetCount, assignedTo, assignedBy, assignedAt, width = 50, height = 30 } = params;
    let cmd = `SIZE ${width} mm, ${height} mm\r\n` +
        `GAP 3 mm, 0\r\n` +
        `DIRECTION 1\r\n` +
        `SET TEAR ON\r\n` +
        `CLS\r\n` +
        `TEXT 15,8,"2",0,1,1,"PACKING TASK"\r\n` +
        `BAR 14,30,374,2\r\n` +
        `TEXT 15,40,"2",0,1,1,"${tsplText(productName, "PRODUCT")} · ${tsplText(variantUnit)}"\r\n` +
        `TEXT 15,66,"2",0,1,1,"Batch: ${tsplText(batchId).slice(-8)}"\r\n` +
        `TEXT 15,92,"3",0,1,1,"Pack: ${packetCount} pkt(s)"\r\n` +
        `TEXT 15,124,"2",0,1,1,"For: ${tsplText(assignedTo)}"\r\n`;
    if (assignedBy)
        cmd += `TEXT 15,150,"1",0,1,1,"By: ${tsplText(assignedBy)}"\r\n`;
    if (assignedAt)
        cmd += `TEXT 200,150,"1",0,1,1,"${tsplText(assignedAt)}"\r\n`;
    cmd += `PRINT 1\r\n`;
    return cmd;
}
// Default target footprint on the label, in printer dots (203 dpi ≈ 8 dots/mm).
// Callers that lay the logo out in a specific box pass their own bounds.
const LOGO_MAX_WIDTH_DOTS = 168;
const LOGO_MAX_HEIGHT_DOTS = 166;
// Pixels darker than this print as black. logoPrintUrl is black artwork on
// transparency composited over white, so the only pixels near the threshold
// are anti-aliased edges — 210 keeps them as ink rather than dropping them and
// thinning the strokes.
const LOGO_LUMA_THRESHOLD = 210;
const logoBitmapCache = new Map();
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = src;
    });
}
/**
 * Rasterise the shared brand logo to a TSPL bitmap, scaled to fit inside a
 * `maxWidthDots` × `maxHeightDots` box (aspect preserved, never upscaled — the
 * source art is 666 × 375). Returns null if it can't be loaded/processed, so
 * callers fall back to a text header. Cached per box size (per page load) so
 * repeated prints are cheap.
 */
export function getLogoBitmap(maxWidthDots = LOGO_MAX_WIDTH_DOTS, maxHeightDots = LOGO_MAX_HEIGHT_DOTS) {
    const cacheKey = `${maxWidthDots}x${maxHeightDots}`;
    const cached = logoBitmapCache.get(cacheKey);
    if (cached)
        return cached;
    const build = (async () => {
        try {
            const img = await loadImage(logoPrintUrl);
            const srcW = img.naturalWidth || img.width;
            const srcH = img.naturalHeight || img.height;
            if (!srcW || !srcH)
                return null;
            const scale = Math.min(maxWidthDots / srcW, maxHeightDots / srcH, 1);
            const wDots = Math.max(1, Math.round(srcW * scale));
            const hDots = Math.max(1, Math.round(srcH * scale));
            const canvas = document.createElement("canvas");
            canvas.width = wDots;
            canvas.height = hDots;
            const ctx = canvas.getContext("2d");
            if (!ctx)
                return null;
            // White background so transparent/edge pixels stay white (no ink).
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, wDots, hDots);
            ctx.drawImage(img, 0, 0, wDots, hDots);
            const { data: px } = ctx.getImageData(0, 0, wDots, hDots);
            const widthBytes = Math.ceil(wDots / 8);
            const out = [];
            for (let y = 0; y < hDots; y++) {
                for (let bCol = 0; bCol < widthBytes; bCol++) {
                    let byte = 0;
                    for (let bit = 0; bit < 8; bit++) {
                        const x = bCol * 8 + bit;
                        let isBlack = false;
                        if (x < wDots) {
                            const i = (y * wDots + x) * 4;
                            const alpha = px[i + 3];
                            const luma = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
                            isBlack = alpha > 128 && luma < LOGO_LUMA_THRESHOLD;
                        }
                        // 1 = white (and padding past the image edge), 0 = black.
                        if (!isBlack)
                            byte |= 0x80 >> bit;
                    }
                    out.push(byte);
                }
            }
            return { width: wDots, widthBytes, height: hDots, data: out };
        }
        catch (err) {
            console.error("[printer] Failed to rasterise logo:", err);
            return null;
        }
    })();
    logoBitmapCache.set(cacheKey, build);
    return build;
}
/**
 * Emit a TSPL BITMAP for the logo centred inside the `size` × `size` box the
 * label editor lays it out in — the editor previews the logo with `object-fit:
 * contain`, so the wordmark (which is wider than it is tall) sits centred
 * vertically in its box. Without this the print would hug the box's top edge.
 */
function logoBitmapCommand(logo, x, y, size) {
    const cx = x + Math.round((size - logo.width) / 2);
    const cy = y + Math.round((size - logo.height) / 2);
    return `BITMAP ${cx},${cy},${logo.widthBytes},${logo.height},0,`;
}
/**
 * Build ONE combined TSPL byte stream for every bag of a delivery handover —
 * a large brand logo on the left, a phone-scannable QR on the right, the
 * tracking id + bag index below the QR. 50 × 30 mm thermal stock.
 *
 * Returns raw bytes (not a string) because the logo is embedded as a TSPL
 * `BITMAP` command with a binary payload.
 */
export async function formatHandoverLabelsTSPLBytes(bags) {
    const media = getLabelMedia();
    const isDouble = media.includes("double");
    const is50 = media.includes("50x50");
    const enc = new TextEncoder();
    const out = [];
    const push = (s) => { for (const b of enc.encode(s))
        out.push(b); };
    // The 50x50 handover lays the logo out in a 200-dot box; the 50x30 keeps the
    // default footprint it already ships with.
    const HANDOVER_LOGO_BOX = 190;
    const logo = is50
        ? await getLogoBitmap(HANDOVER_LOGO_BOX, HANDOVER_LOGO_BOX)
        : await getLogoBitmap();
    const width = 50;
    const height = is50 ? 50 : 30;
    const gapMm = 0;
    const pitchDots = (width + gapMm) * 8; // 400 dots
    const sheetWidthMm = isDouble ? 102.5 : width; // 102.5 mm width for 2-Up backing
    const dxL = isDouble ? 20 : 0;
    const dxR = isDouble ? 420 : 0;
    const appendHandoverLabelBody = (bag, dx) => {
        const idline = `${bag.trackingId} ${bag.bagIndex}/${bag.totalBags}`;
        const qrUrl = buildProductQrUrl(bag.bagCode);
        if (is50) {
            // 50x50 design (using user-dragged coordinates):
            // - Title: x: dx+21, y: 99
            // - Underline: x: dx+17, y: 119
            // - Logo: 190-dot box at x: dx+11, y: 116
            // - QR: x: dx+227, y: 140
            // - ID Line: x: dx+127, y: 331
            push(`TEXT ${dx + 21},99,"2",0,1,1,"DELIVERY HANDOVER"\r\n`);
            push(`BAR ${dx + 17},119,374,1\r\n`);
            if (logo) {
                push(logoBitmapCommand(logo, dx + 11, 116, HANDOVER_LOGO_BOX));
                for (const b of logo.data)
                    out.push(b);
                push(`\r\n`);
            }
            else {
                push(`TEXT ${dx + 34},170,"3",0,1,1,"FRESHON.IN"\r\n`);
            }
            push(`QRCODE ${dx + 227},140,M,5,A,0,M2,S7,"${tsplText(qrUrl)}"\r\n`);
            push(`TEXT ${dx + 127},331,"1",0,1,1,"${tsplText(idline)}"\r\n`);
        }
        else {
            // 50x30 design:
            // - Title: x: dx+15, y: 9
            // - Underline: x: dx+14, y: 32
            // - Logo: x: dx+15, y: 40 (or text "FRESHON.IN" at dx+15, y: 90)
            // - QR: x: dx+231, y: 38
            // - ID Line: x: dx+231, y: 210
            push(`TEXT ${dx + 15},9,"2",0,1,1,"DELIVERY HANDOVER"\r\n`);
            push(`BAR ${dx + 14},32,374,2\r\n`);
            if (logo) {
                push(`BITMAP ${dx + 15},40,${logo.widthBytes},${logo.height},0,`);
                for (const b of logo.data)
                    out.push(b);
                push(`\r\n`);
            }
            else {
                push(`TEXT ${dx + 15},90,"3",0,1,1,"FRESHON.IN"\r\n`);
            }
            push(`QRCODE ${dx + 231},38,M,5,A,0,M2,S7,"${tsplText(qrUrl)}"\r\n`);
            push(`TEXT ${dx + 231},210,"1",0,1,1,"${tsplText(idline)}"\r\n`);
        }
    };
    if (isDouble) {
        for (let i = 0; i < bags.length; i += 2) {
            push(`SIZE ${sheetWidthMm} mm, ${height} mm\r\n`);
            push(`GAP 3 mm, 0\r\n`);
            push(`DIRECTION 1\r\n`);
            push(`SET TEAR ON\r\n`);
            push(`CLS\r\n`);
            appendHandoverLabelBody(bags[i], dxL);
            if (bags[i + 1]) {
                appendHandoverLabelBody(bags[i + 1], dxR);
            }
            push(`PRINT 1\r\n`);
        }
    }
    else {
        for (const bag of bags) {
            push(`SIZE ${width} mm, ${height} mm\r\n`);
            push(`GAP 3 mm, 0\r\n`);
            push(`DIRECTION 1\r\n`);
            push(`SET TEAR ON\r\n`);
            push(`CLS\r\n`);
            appendHandoverLabelBody(bag, 0);
            push(`PRINT 1\r\n`);
        }
    }
    return out;
}
//# sourceMappingURL=printer.js.map