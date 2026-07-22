// packages/freshon-api/src/receipt.ts
// SINGLE SOURCE OF TRUTH for the FreshOn thermal-receipt layout.
//
// This is the tag-based text that gets rasterised to the thermal printer
// (Fpos/src-tauri/src/lib.rs) and rendered on screen by each app's ReceiptPreview.
// Both Fpos (POS) and Consumer_app (Bills) map their own data into `ReceiptData`
// and call `buildReceiptText` — so the printed bill and every in-app preview share
// one layout. Change the format HERE only.
//
// History: ported out of Fpos/src/pos/components/ReceiptModal.tsx so the consumer
// bill could be a byte-for-byte replica of the in-store print.
/** The live store identity printed on every FreshOn receipt. */
export const FRESHON_STORE = {
    name: "Eliteck Solutions & Services PVT Ltd",
    addressLines: ["17, 80 ft Road, Kengeri Ring Road,", "Mallathalli,Bengaluru-560056"],
    phone: "8884463083,9591241245",
    gstin: "29AADCE6858N3ZS",
    fssai: "11222332000572",
};
/** GST is charged inclusive of price: taxable = amount / (1 + rate/100). */
export function computeGstBuckets(items) {
    const map = {};
    for (const item of items) {
        const rate = item.gstRate ?? 0;
        if (rate === 0)
            continue;
        const amount = item.amount;
        const taxableValue = amount / (1 + rate / 100);
        const totalGst = amount - taxableValue;
        if (!map[rate]) {
            map[rate] = {
                rate,
                taxableValue: 0,
                cgstRate: rate / 2,
                cgstAmt: 0,
                sgstRate: rate / 2,
                sgstAmt: 0,
                totalGst: 0,
            };
        }
        map[rate].taxableValue += taxableValue;
        map[rate].cgstAmt += totalGst / 2;
        map[rate].sgstAmt += totalGst / 2;
        map[rate].totalGst += totalGst;
    }
    return Object.values(map).map((b) => ({
        ...b,
        taxableValue: +b.taxableValue.toFixed(2),
        cgstAmt: +b.cgstAmt.toFixed(2),
        sgstAmt: +b.sgstAmt.toFixed(2),
        totalGst: +b.totalGst.toFixed(2),
    }));
}
// ─── Plain-text receipt formatter (48 chars wide matching cbill.jpeg) ───────────
const W = 48;
const leftRight = (l, r, width = W) => {
    const gap = Math.max(1, width - l.length - r.length);
    return l + " ".repeat(gap) + r;
};
const rpad = (s, n) => s.slice(0, n).padEnd(n, " ");
const lpad = (s, n) => s.slice(0, n).padStart(n, " ");
/**
 * Build the tagged receipt text for one transaction. The output is consumed by
 * each app's ReceiptPreview renderer and by the Rust thermal printer.
 */
export function buildReceiptText(data) {
    const store = data.store ?? FRESHON_STORE;
    const discountPct = data.prideDiscountPct ?? 0.3;
    const lines = [];
    const p = (s) => lines.push(s);
    // ─── Header ───
    p(`[C][B]${store.name}[b][c]`);
    for (let i = 0; i < store.addressLines.length; i++) {
        const last = i === store.addressLines.length - 1;
        p(`[C]${store.addressLines[i]}${last ? "[S]" : ""}[c]`);
    }
    p(`[C][XL]Phone: ${store.phone}[xl][c]`);
    p(`[C][XL]GSTIN : ${store.gstin}[xl][c]`);
    p(`[C][XL]fssai : ${store.fssai}[xl][c]`);
    p("[S]");
    p("[C][B][XL]TAX INVOICE[xl][b][c]");
    p("");
    if (data.isReturn) {
        p("[C][B]*** REFUND ***[b][c]");
        p("");
    }
    // ─── Metadata ───
    const invNo = data.invoiceNumber;
    const dateObj = new Date(data.timestamp);
    const dateStr = dateObj
        .toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })
        .replace(/\//g, "-");
    const timeStr = dateObj.toLocaleTimeString("en-GB", { hour12: false });
    p(`[LR]Bill No : | ${invNo}[lr]`);
    p(`[LR]Date : | ${dateStr}[lr]`);
    const custNameStr = data.customerName || "Walk-in";
    const custPhoneStr = data.customerPhone || "";
    p(`[LR]${custNameStr} ${custPhoneStr}`.trim() + `| ${timeStr}[lr]`);
    if (data.company) {
        p(leftRight(`Company : ${data.company.name}`, `GSTIN: ${data.company.gstin}`));
    }
    if (data.orderTypeLabel) {
        p(`[LR]Order Type : ${data.orderTypeLabel}| [lr]`);
    }
    // ─── Items Table (Aligned for 48 chars) ───
    p("[HR]");
    const itemRow = (sn, name, mrp, qty, amt) => 
    // Columns: SN(2) Name(23) MRP(4) Qty(5) Amt(9)
    rpad(sn, 2) + " " + rpad(name, 23) + " " + lpad(mrp, 4) + " " + lpad(qty, 5) + " " + lpad(amt, 9);
    p(`[M]${itemRow("Sn", "Item Name", "MRP", "Qty", "Amount")}[m]`);
    p("[HR]");
    data.items.forEach((item, idx) => {
        const qty = item.weighed ? item.quantity.toFixed(1) : String(item.quantity);
        const name = item.name.toUpperCase();
        p(`[M]${itemRow(String(idx + 1), name, item.unitPrice.toFixed(0), qty, item.amount.toFixed(2))}[m][EES]`);
    });
    p("[HR]");
    // ─── Totals ───
    const totalQty = data.items.reduce((s, i) => s + i.quantity, 0);
    const totalLabel = rpad("Total", 26); // Aligns with Name field
    p(totalLabel + lpad(totalQty.toFixed(1), 10) + lpad(data.subtotal.toFixed(2), 11));
    p("[HR]");
    // ─── Delivery (online only) ───
    if ((data.deliveryFee ?? 0) > 0) {
        p(leftRight("          Delivery :", data.deliveryFee.toFixed(2)));
    }
    // ─── Round Off & Net Bill ───
    const roundOffStr = (data.roundingAdjustment || 0).toFixed(2).replace(/^0\./, "."); // Renders .10 instead of 0.10 to match OCR
    p(leftRight("          Round-Off :", roundOffStr));
    p(`[B][L]${leftRight("Net Bill Amount :", `₹ ${data.total.toFixed(2)}`, 39)}[l][b]`); // 39 adjusts width perfectly for the [L] scaler multiplier
    p("[HR]");
    p("[S]");
    // ─── Payment Details (Right Aligned mini-table) ───
    p("[R]Payment Details[r]");
    p("[R]---------------[r]");
    for (const t of data.tenders) {
        p(`[R]${rpad(t.method, 10)} ${lpad(t.amount.toFixed(2), 8)}[r]`);
    }
    if ((data.walletCreditAmount ?? 0) > 0) {
        p(`[R]${rpad("To Wallet", 10)} ${lpad(data.walletCreditAmount.toFixed(2), 8)}[r]`);
    }
    // ─── GST Summary Box ───
    const gstBuckets = computeGstBuckets(data.items);
    if (gstBuckets.length > 0) {
        p("[GST_TITLE]");
        p("[GST_HEADER]");
        for (const b of gstBuckets) {
            p("|" + lpad(b.taxableValue.toFixed(2), 7) +
                "|" + lpad(b.cgstRate.toFixed(1), 3) +
                "|" + lpad(b.cgstAmt.toFixed(2), 6) +
                "|" + lpad(b.sgstRate.toFixed(1), 3) +
                "|" + lpad(b.sgstAmt.toFixed(2), 6) +
                "|" + lpad(b.totalGst.toFixed(2), 7) + "|");
        }
        const totalTaxable = gstBuckets.reduce((s, b) => s + b.taxableValue, 0);
        const totalCgst = gstBuckets.reduce((s, b) => s + b.cgstAmt, 0);
        const totalSgst = gstBuckets.reduce((s, b) => s + b.sgstAmt, 0);
        const totalGstAmt = gstBuckets.reduce((s, b) => s + b.totalGst, 0);
        p("[GST_TOTAL]" +
            totalTaxable.toFixed(2) + "|" +
            totalCgst.toFixed(2) + "|" +
            totalSgst.toFixed(2) + "|" +
            totalGstAmt.toFixed(2) + "[gst_total]");
    }
    // ─── Savings (Dashed lines) & Footer Text ───
    const actualSavings = data.memberDiscount || 0;
    // Potential PRIDE savings shown to non-members = half the net bill amount.
    const potentialSavings = +(data.total * 0.5).toFixed(2);
    p("-".repeat(58));
    if (data.isPride) {
        p(`[C][B][XL]--You saved Rs. ${actualSavings.toFixed(2)} with Pride--[xl][b][c]`);
    }
    else if (!data.isAnonymous) {
        p(`[C][B][XL]--Join Pride to save Rs. ${potentialSavings.toFixed(2)}! --[xl][b][c]`);
        p("[EES]");
        p("[C]Ask us how[c]");
    }
    else {
        p(`[C][B][XL]--JOIN Pride to save Rs. ${potentialSavings.toFixed(2)} --[xl][b][c]`);
        p("[EES]");
        p("[C]Ask us how[c]");
    }
    p("[C]" + "-".repeat(50) + "[c]");
    p("[C]www.freshon.in[c]");
    p("[C][B]Thank You for Choosing FreshOn.In![b][c]");
    p("");
    p("[C]Shop anytime, anywhere! Scan the QR code to[c]");
    p("[C]order online with our mobile app.[c]");
    p("");
    p("[QR]https://freshon.in/iphone[qr] [QR]https://freshon.in/android[qr]");
    p("[S]");
    p(`[C][BAR]${invNo}[bar][c]`);
    p(`[C]${invNo}[c]`);
    p("[S]");
    return lines.join("\n");
}
//# sourceMappingURL=receipt.js.map