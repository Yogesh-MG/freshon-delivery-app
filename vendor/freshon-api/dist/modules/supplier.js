// packages/freshon-api/src/modules/supplier.ts
// B2B Supplier (Supplier_app role) module — OTP login, org profile, consignments,
// running-account ledger, settlement invoices, and KYC documents.
// Maps to the apps/supplier/ Django app.
import { getClient } from "../client";
// ─── Registration & Auth ──────────────────────────────────────────────
/** Two-step phone-OTP login for supplier contacts. POST /api/supplier/register/ */
export async function registerSupplier(data) {
    const res = await getClient().post("/api/supplier/register/", data);
    return res.data;
}
// ─── Profile ──────────────────────────────────────────────────────────
export async function getProfile() {
    const res = await getClient().get("/api/supplier/profile/");
    return res.data;
}
export async function updateProfile(data) {
    const res = await getClient().patch("/api/supplier/profile/", data);
    return res.data;
}
// ─── Dashboard ────────────────────────────────────────────────────────
export async function getDashboard() {
    const res = await getClient().get("/api/supplier/dashboard/");
    return res.data;
}
// ─── Consignments (ASNs) ──────────────────────────────────────────────
export async function listConsignments() {
    const res = await getClient().get("/api/supplier/consignments/");
    return res.data;
}
export async function createConsignment(data) {
    const res = await getClient().post("/api/supplier/consignments/", data);
    return res.data;
}
// ─── Ledger / Reconciliation ──────────────────────────────────────────
export async function getLedger() {
    const res = await getClient().get("/api/supplier/ledger/");
    return res.data;
}
// ─── Invoices ─────────────────────────────────────────────────────────
export async function listInvoices() {
    const res = await getClient().get("/api/supplier/invoices/");
    return res.data;
}
// ─── Documents ────────────────────────────────────────────────────────
export async function listDocuments() {
    const res = await getClient().get("/api/supplier/documents/");
    return res.data;
}
// ─── FOS admin: supplier approval (not auto-approved) ─────────────────
/** FOS admin: suppliers awaiting approval. GET /api/supplier/fos/approvals/ */
export async function listSupplierApprovals() {
    const res = await getClient().get("/api/supplier/fos/approvals/");
    return res.data;
}
/**
 * FOS admin: approve or reject a supplier.
 * POST /api/supplier/fos/approvals/{supplierId}/decide/
 * approve → ACTIVE, reject → SUSPENDED.
 */
export async function decideSupplierApproval(supplierId, action) {
    const res = await getClient().post(`/api/supplier/fos/approvals/${supplierId}/decide/`, { action });
    return res.data;
}
export async function uploadDocument(docType, file, expiryDate) {
    const formData = new FormData();
    formData.append("doc_type", docType);
    formData.append("file", file);
    if (expiryDate)
        formData.append("expiry_date", expiryDate);
    const res = await getClient().post("/api/supplier/documents/", formData);
    return res.data;
}
//# sourceMappingURL=supplier.js.map