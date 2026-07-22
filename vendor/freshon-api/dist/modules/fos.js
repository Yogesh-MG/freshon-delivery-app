// packages/freshon-api/src/modules/fos.ts
// FOS (Field Operations System) module — Dashboard, Finance, HR, Orders, Support, Inventory.
// Maps to Django's apps/pos/fos_views.py endpoints.
import { getClient } from "../client";
// ─── Dashboard ────────────────────────────────────────────────────────────────
/**
 * Get dashboard KPIs.
 * GET /api/pos/fos/dashboard/kpis/
 */
export async function getDashboardKpis() {
    const res = await getClient().get("/api/pos/fos/dashboard/kpis/");
    return res.data;
}
/** GET /api/pos/fos/dashboard/revenue/?range=... — real GMV/orders for the window. */
export async function getRevenueByRange(range) {
    const res = await getClient().get("/api/pos/fos/dashboard/revenue/", { params: { range } });
    return res.data;
}
/**
 * Get hourly sales data for today.
 * GET /api/pos/fos/dashboard/hourly-sales/
 */
export async function getHourlySales() {
    const res = await getClient().get("/api/pos/fos/dashboard/hourly-sales/");
    return res.data;
}
/**
 * Top-tile finance KPIs (cash position, partner count, reconciliation %, overdue).
 * GET /api/pos/fos/finance/summary/
 */
export async function getFinanceSummary() {
    const res = await getClient().get("/api/pos/fos/finance/summary/");
    return res.data;
}
/**
 * Get bank statement sync log.
 * GET /api/pos/fos/finance/bank-statements/
 */
export async function getBankStatements() {
    const res = await getClient().get("/api/pos/fos/finance/bank-statements/");
    return res.data;
}
/**
 * Get receivables with aging buckets.
 * GET /api/pos/fos/finance/receivables/
 */
export async function getReceivables() {
    const res = await getClient().get("/api/pos/fos/finance/receivables/");
    return res.data;
}
/**
 * Send WhatsApp/SMS reminder to a partner.
 * POST /api/pos/fos/finance/send-reminder/
 */
export async function sendReminder(data) {
    const res = await getClient().post("/api/pos/fos/finance/send-reminder/", data);
    return res.data;
}
// ─── HR ───────────────────────────────────────────────────────────────────────
/**
 * Get employees with attendance and payroll data.
 * GET /api/pos/fos/hr/employees/
 */
export async function getEmployees() {
    const res = await getClient().get("/api/hr/employees/");
    return res.data;
}
/**
 * Get leave requests.
 * GET /api/pos/fos/hr/leaves/
 */
export async function getLeaves() {
    const res = await getClient().get("/api/pos/fos/hr/leaves/");
    return res.data;
}
/**
 * Update leave request status (approve/reject).
 * PATCH /api/pos/fos/hr/leaves/
 */
export async function updateLeaveStatus(data) {
    const res = await getClient().patch("/api/pos/fos/hr/leaves/", data);
    return res.data;
}
/**
 * Process payroll and queue transfers.
 * POST /api/pos/fos/hr/process-payroll/
 */
export async function processPayroll() {
    const res = await getClient().post("/api/pos/fos/hr/process-payroll/");
    return res.data;
}
// ─── Orders ───────────────────────────────────────────────────────────────────
/**
 * Get smart orders with AI risk scoring (legacy: full array, up to 500 recent).
 * GET /api/pos/fos/orders/?status=&search=
 */
export async function getFosOrders(params) {
    const res = await getClient().get("/api/pos/fos/orders/", { params });
    return res.data;
}
/**
 * Get smart orders one page at a time (lazy pagination). Open orders sort first.
 * GET /api/pos/fos/orders/?page=&page_size=&status=&search=&order_type=
 */
export async function getFosOrdersPaged(params) {
    const res = await getClient().get("/api/pos/fos/orders/", {
        params: { page: 1, page_size: 10, ...params },
    });
    return res.data;
}
/**
 * Full detail for one order (Smart Orders popup).
 * GET /api/pos/fos/orders/<tracking_id>/
 */
export async function getFosOrderDetail(trackingId) {
    const res = await getClient().get(`/api/pos/fos/orders/${encodeURIComponent(trackingId)}/`);
    return res.data;
}
/**
 * Founder/admin manual override of an order's status (e.g. to update the delivery
 * status of a manually-delivered order). Returns the refreshed order detail.
 * PATCH /api/pos/fos/orders/<tracking_id>/
 */
export async function updateFosOrderStatus(trackingId, status) {
    const res = await getClient().patch(`/api/pos/fos/orders/${encodeURIComponent(trackingId)}/`, { status });
    return res.data;
}
/**
 * Founder/admin manual payment reconciliation — mark an unpaid / failed /
 * escalated order's payment status and record the transaction id that came in
 * out-of-band. Setting COMPLETED flips is_paid. Audit-logged server-side.
 * Returns the refreshed order detail.
 * PATCH /api/pos/fos/orders/<tracking_id>/
 */
export async function updateFosOrderPayment(trackingId, input) {
    const res = await getClient().patch(`/api/pos/fos/orders/${encodeURIComponent(trackingId)}/`, { payment_status: input.payment_status, transaction_id: input.transaction_id ?? "" });
    return res.data;
}
/**
 * Download all matching orders (current filters, every page) as a CSV blob.
 * GET /api/pos/fos/orders/?export=csv
 */
export async function exportFosOrdersCsv(params) {
    const res = await getClient().get("/api/pos/fos/orders/", {
        params: { ...params, export: "csv" },
        responseType: "blob",
    });
    return res.data;
}
// ─── Support ──────────────────────────────────────────────────────────────────
/**
 * Get support tickets with SLA and sentiment.
 * GET /api/pos/fos/support/tickets/
 */
export async function getTickets() {
    const res = await getClient().get("/api/pos/fos/support/tickets/");
    return res.data;
}
/**
 * Generate AI reply for a ticket.
 * POST /api/pos/fos/support/ai-reply/
 */
export async function generateAiReply(data) {
    const res = await getClient().post("/api/pos/fos/support/ai-reply/", data);
    return res.data;
}
// ─── Inventory ─────────────────────────────────────────────────────────────────
/**
 * Get inventory with AI demand predictions.
 * GET /api/pos/fos/inventory/
 */
export async function getFosInventory(params) {
    const res = await getClient().get("/api/pos/fos/inventory/", { params });
    return res.data;
}
/**
 * Override an inventory item's stock / price / threshold (founder & admin only).
 * Backend gates this with IsFounderOrAdmin and audits every change.
 * PATCH /api/pos/fos/inventory/  body: { id, ...fields }
 */
export async function updateFosInventoryItem(id, body) {
    const res = await getClient().patch("/api/pos/fos/inventory/", { id, ...body });
    return res.data;
}
/** All of a product's pack-size variants (by any of its batch ids) for the editor. */
export async function getFosProductVariants(batchId) {
    const res = await getClient().get("/api/pos/fos/inventory/variants/", { params: { batch: batchId } });
    return res.data;
}
/** Bulk-update a product's variant prices + stock (or shared pool). Founder/admin. */
export async function updateFosProductVariants(body) {
    const res = await getClient().patch("/api/pos/fos/inventory/variants/", body);
    return res.data;
}
/**
 * Pack `count` retail packs of a variant out of the PRODUCT-LEVEL raw pool.
 * Draws count × per-pack weight from Product.raw_stock_grams and mints that many
 * finished serialized packs (on the shelf) for the variant.
 * POST /api/pos/fos/inventory/pack/  body: { product_id, variant_id, count }
 */
export async function packFromRawPool(productId, variantId, count) {
    const res = await getClient().post("/api/pos/fos/inventory/pack/", { product_id: productId, variant_id: variantId, count });
    return res.data;
}
/**
 * Active-inventory KPI tiles (counts over all approved in-stock batches).
 * GET /api/pos/fos/inventory/summary/
 */
export async function getFosInventorySummary() {
    const res = await getClient().get("/api/pos/fos/inventory/summary/");
    return res.data;
}
/**
 * Get dead stock and slow movers.
 * GET /api/pos/fos/inventory/dead-stock/
 */
export async function getDeadStock() {
    const res = await getClient().get("/api/pos/fos/inventory/dead-stock/");
    return res.data;
}
// ─── AI Agent ─────────────────────────────────────────────────────────────────
/**
 * Query the AI agent.
 * POST /api/pos/fos/agent/query/
 */
export async function queryAgent(data) {
    const res = await getClient().post("/api/pos/fos/agent/query/", data);
    return res.data;
}
// ─── Purchase Orders ──────────────────────────────────────────────────────────
/**
 * Get all Purchase Orders.
 * GET /api/pos/fos/purchase-orders/?status=
 */
export async function getPurchaseOrders(params) {
    const res = await getClient().get("/api/pos/fos/purchase-orders/", { params });
    return res.data;
}
/**
 * Form options for raising a PO: farmers, suppliers, active variants, warehouses.
 * GET /api/pos/fos/purchase-orders/options/
 */
export async function getPurchaseOrderOptions() {
    const res = await getClient().get("/api/pos/fos/purchase-orders/options/");
    return res.data;
}
/**
 * Raise a procurement Purchase Order — one vendor, one or more products.
 *
 * Pass `items: [...]` for a multi-product PO; the flat single-product shape still
 * works and is treated as a one-line document. Either way this returns the whole
 * PO document (a pending batch + PENDING PO line per product).
 *
 * POST /api/pos/fos/purchase-orders/create/
 */
export async function createPurchaseOrder(data) {
    const res = await getClient().post("/api/pos/fos/purchase-orders/create/", data);
    return res.data;
}
/**
 * PO documents, newest first, one page at a time — this is what the FOS PO
 * list renders. GET /api/pos/fos/purchase-orders/groups/?status=&page=&page_size=
 */
export async function fetchPurchaseOrderGroups(params) {
    const res = await getClient().get("/api/pos/fos/purchase-orders/groups/", { params });
    return res.data;
}
/**
 * One PO document with all its product lines.
 * GET /api/pos/fos/purchase-orders/groups/<group_id>/
 */
export async function fetchPurchaseOrderGroup(groupId) {
    const res = await getClient().get(`/api/pos/fos/purchase-orders/groups/${groupId}/`);
    return res.data;
}
/**
 * Edit a PENDING PO document — its header, vendor, and product lines.
 *
 * The lines are REPLACED by `items`, so this is how products are added, removed and
 * reordered. Safe only while PENDING (nothing has been priced or received yet). The
 * group keeps its number, since the vendor may already have been sent it.
 *
 * PATCH /api/pos/fos/purchase-orders/groups/<group_id>/
 */
export async function updatePurchaseOrderGroup(groupId, data) {
    const res = await getClient().patch(`/api/pos/fos/purchase-orders/groups/${groupId}/`, data);
    return res.data;
}
/**
 * Approve a whole PO document. Every line is priced independently — different
 * products, different costs, different GST — so `lines` carries a decision each.
 * All prices are PER VARIANT PACK. Atomic: one bad line approves none of them.
 *
 * POST /api/pos/fos/purchase-orders/groups/<group_id>/approve/
 */
export async function approvePurchaseOrderGroup(groupId, lines) {
    const res = await getClient().post(`/api/pos/fos/purchase-orders/groups/${groupId}/approve/`, { lines });
    return res.data;
}
/**
 * Reject a whole PENDING PO document. Already-approved lines are left alone.
 * POST /api/pos/fos/purchase-orders/groups/<group_id>/reject/
 */
export async function rejectPurchaseOrderGroup(groupId) {
    const res = await getClient().post(`/api/pos/fos/purchase-orders/groups/${groupId}/reject/`);
    return res.data;
}
/**
 * Receive a whole PO document at the hub. Each product is weighed separately, so
 * the actual quantity is per line. Omit `lines` to receive every approved line at
 * its expected quantity.
 *
 * POST /api/pos/fos/purchase-orders/groups/<group_id>/receive/
 */
export async function receivePurchaseOrderGroup(groupId, lines) {
    const res = await getClient().post(`/api/pos/fos/purchase-orders/groups/${groupId}/receive/`, lines ? { lines } : {});
    return res.data;
}
/**
 * Send a whole PO document to its vendor as ONE WhatsApp message listing every line.
 * POST /api/pos/fos/purchase-orders/groups/<group_id>/send/
 */
export async function sendPurchaseOrderGroup(groupId) {
    const res = await getClient().post(`/api/pos/fos/purchase-orders/groups/${groupId}/send/`);
    return res.data;
}
/**
 * Edit a PENDING Purchase Order before approval (fix scanned/auto-created POs).
 * PATCH /api/pos/fos/purchase-orders/<po_id>/
 */
export async function updatePurchaseOrder(poId, data) {
    const res = await getClient().patch(`/api/pos/fos/purchase-orders/${poId}/`, data);
    return res.data;
}
/**
 * Send a Purchase Order to its source (supplier/farmer) over WhatsApp.
 * POST /api/pos/fos/purchase-orders/<po_id>/send/
 */
export async function sendPurchaseOrder(poId) {
    const res = await getClient().post(`/api/pos/fos/purchase-orders/${poId}/send/`);
    return res.data;
}
/**
 * Reject a PENDING Purchase Order.
 * POST /api/pos/fos/purchase-orders/<po_id>/reject/
 */
export async function rejectPurchaseOrder(poId) {
    const res = await getClient().post(`/api/pos/fos/purchase-orders/${poId}/reject/`);
    return res.data;
}
/**
 * Approve a Purchase Order with pricing and GST configuration.
 * POST /api/pos/fos/purchase-orders/<po_id>/approve/
 *
 * Every price here is PER VARIANT PACK. The taxable line total is derived
 * server-side from the pack count — never send a total.
 */
export async function approvePurchaseOrder(poId, data) {
    const res = await getClient().post(`/api/pos/fos/purchase-orders/${poId}/approve/`, data);
    return res.data;
}
/**
 * Receive a Purchase Order (mark stock as arrived at warehouse).
 * POST /api/pos/fos/purchase-orders/<po_id>/receive/
 */
export async function receivePurchaseOrder(poId) {
    const res = await getClient().post(`/api/pos/fos/purchase-orders/${poId}/receive/`);
    return res.data;
}
/**
 * Validate a scanned barcode.
 * GET /api/pos/fos/inventory/barcode/validate/?barcode=
 */
export async function validateBarcode(barcode) {
    const res = await getClient().get("/api/pos/fos/inventory/barcode/validate/", { params: { barcode } });
    return res.data;
}
// ─── Stock Reconciliation & Shrinkage ─────────────────────────────────────────
/**
 * Perform stock reconciliation on an inventory batch.
 * Adjusts stock level and logs shrinkage for moisture loss.
 * POST /api/pos/fos/inventory/reconcile/
 */
export async function reconcileStock(data) {
    const res = await getClient().post("/api/pos/fos/inventory/reconcile/", data);
    return res.data;
}
/**
 * Get shrinkage report for a period.
 * GET /api/pos/fos/inventory/shrinkage-report/?period=
 */
export async function getShrinkageReport(params) {
    const res = await getClient().get("/api/pos/fos/inventory/shrinkage-report/", { params });
    return res.data;
}
// ─── Live Delivery Tracking ───────────────────────────────────────────────────
/**
 * Get active deliveries for the live operational map.
 * GET /api/pos/fos/dashboard/active-deliveries/
 */
export async function getActiveDeliveries() {
    const res = await getClient().get("/api/pos/fos/dashboard/active-deliveries/");
    return res.data;
}
/**
 * FOS operator confirms/corrects a delivery the live-ops map could only
 * track approximately (or just signs off on any active delivery).
 * POST /api/pos/fos/dashboard/active-deliveries/{assignmentId}/verify/
 */
export async function verifyDelivery(assignmentId, payload) {
    const res = await getClient().post(`/api/pos/fos/dashboard/active-deliveries/${assignmentId}/verify/`, payload);
    return res.data;
}
/**
 * Get dynamic operational/AI insights.
 * GET /api/pos/fos/dashboard/insights/
 */
export async function getDashboardInsights() {
    const res = await getClient().get("/api/pos/fos/dashboard/insights/");
    return res.data;
}
/**
 * Get live operational/system notifications.
 * GET /api/pos/fos/dashboard/notifications/
 */
export async function getDashboardNotifications() {
    const res = await getClient().get("/api/pos/fos/dashboard/notifications/");
    return res.data;
}
/**
 * Create a new employee (User + EmployeeProfile + SalaryStructure).
 * POST /api/hr/employees/
 */
export async function createEmployee(data) {
    const res = await getClient().post("/api/hr/employees/", data);
    return res.data;
}
/**
 * List HR documents. Pass { unassigned: true } for the scan inbox, or
 * { employee } for one employee's documents.
 * GET /api/hr/documents/
 */
export async function getScannedDocuments(params = {}) {
    const query = {};
    if (params.unassigned)
        query.unassigned = "1";
    if (params.employee)
        query.employee = params.employee;
    const res = await getClient().get("/api/hr/documents/", { params: query });
    return res.data;
}
/**
 * Assign an inbox document to an employee (and/or set its type).
 * PATCH /api/hr/documents/<id>/
 */
export async function assignDocument(documentId, data) {
    const res = await getClient().patch(`/api/hr/documents/${documentId}/`, data);
    return res.data;
}
/**
 * Discard a scanned document.
 * DELETE /api/hr/documents/<id>/
 */
export async function deleteDocument(documentId) {
    await getClient().delete(`/api/hr/documents/${documentId}/`);
}
/**
 * Get FOS settings.
 * GET /api/pos/settings/
 */
export async function getSettings() {
    const res = await getClient().get("/api/pos/settings/");
    return res.data;
}
/**
 * Update FOS settings.
 * POST /api/pos/settings/
 */
export async function updateSettings(data) {
    const res = await getClient().post("/api/pos/settings/", data);
    return res.data;
}
// =============================================================================
// FOS PERMISSIONS API
// =============================================================================
/**
 * Get current user's FOS permissions.
 * GET /api/pos/fos/permissions/me/
 */
export async function getCurrentUserPermissions() {
    const res = await getClient().get("/api/pos/fos/permissions/me/");
    return res.data;
}
/**
 * Check if user has specific permission(s).
 * POST /api/pos/fos/permissions/check/
 */
export async function checkPermission(data) {
    const res = await getClient().post("/api/pos/fos/permissions/check/", data);
    return res.data;
}
/**
 * Check if user has access to a module.
 * GET /api/pos/fos/permissions/check-module/<module_codename>/
 */
export async function checkModuleAccess(moduleCodename) {
    const res = await getClient().get(`/api/pos/fos/permissions/check-module/${moduleCodename}/`);
    return res.data;
}
/**
 * List all FOS modules.
 * GET /api/pos/fos/permissions/modules/
 */
export async function getFosModules() {
    const res = await getClient().get("/api/pos/fos/permissions/modules/");
    return res.data;
}
/**
 * List all FOS permissions.
 * GET /api/pos/fos/permissions/permissions/
 */
export async function getFosPermissions(params) {
    const res = await getClient().get("/api/pos/fos/permissions/permissions/", { params });
    return res.data;
}
/**
 * List all FOS roles.
 * GET /api/pos/fos/permissions/roles/
 */
export async function getFosRoles() {
    const res = await getClient().get("/api/pos/fos/permissions/roles/");
    return res.data;
}
/**
 * Create a new FOS role.
 * POST /api/pos/fos/permissions/roles/
 */
export async function createFosRole(data) {
    const res = await getClient().post("/api/pos/fos/permissions/roles/", data);
    return res.data;
}
/**
 * Get FOS role details.
 * GET /api/pos/fos/permissions/roles/<id>/
 */
export async function getFosRole(id) {
    const res = await getClient().get(`/api/pos/fos/permissions/roles/${id}/`);
    return res.data;
}
/**
 * Update FOS role.
 * PATCH /api/pos/fos/permissions/roles/<id>/
 */
export async function updateFosRole(id, data) {
    const res = await getClient().patch(`/api/pos/fos/permissions/roles/${id}/`, data);
    return res.data;
}
/**
 * Delete FOS role.
 * DELETE /api/pos/fos/permissions/roles/<id>/
 */
export async function deleteFosRole(id) {
    await getClient().delete(`/api/pos/fos/permissions/roles/${id}/`);
}
/**
 * List employee permissions.
 * GET /api/pos/fos/permissions/employee-permissions/
 */
export async function getEmployeePermissions(params) {
    const res = await getClient().get("/api/pos/fos/permissions/employee-permissions/", { params });
    return res.data;
}
/**
 * Grant permission to employee.
 * POST /api/pos/fos/permissions/employee-permissions/
 */
export async function grantEmployeePermission(data) {
    const res = await getClient().post("/api/pos/fos/permissions/employee-permissions/", data);
    return res.data;
}
/**
 * Revoke employee permission.
 * DELETE /api/pos/fos/permissions/employee-permissions/<id>/
 */
export async function revokeEmployeePermission(id) {
    await getClient().delete(`/api/pos/fos/permissions/employee-permissions/${id}/`);
}
/**
 * The real staff roster + the FOS role each person holds. Drives the Access
 * Control screen's role assignment.
 *
 * Not to be confused with `getEmployees()` (/fos/hr/employees/), which still
 * returns hardcoded mock people and must never be used to grant authority.
 *
 * GET /api/pos/fos/permissions/employees/
 */
export async function getPermissionEmployees() {
    const res = await getClient().get("/api/pos/fos/permissions/employees/");
    return res.data;
}
/**
 * List employee roles.
 * GET /api/pos/fos/permissions/employee-roles/
 */
export async function getEmployeeRoles(params) {
    const res = await getClient().get("/api/pos/fos/permissions/employee-roles/", { params });
    return res.data;
}
/**
 * Assign role to employee.
 * POST /api/pos/fos/permissions/employee-roles/
 */
export async function assignEmployeeRole(data) {
    const res = await getClient().post("/api/pos/fos/permissions/employee-roles/", data);
    return res.data;
}
/**
 * Remove employee role.
 * DELETE /api/pos/fos/permissions/employee-roles/<id>/
 */
export async function removeEmployeeRole(id) {
    await getClient().delete(`/api/pos/fos/permissions/employee-roles/${id}/`);
}
/**
 * Initialize default permissions and roles.
 * POST /api/pos/fos/permissions/initialize/
 */
export async function initializeFosPermissions() {
    const res = await getClient().post("/api/pos/fos/permissions/initialize/");
    return res.data;
}
/**
 * Get employee permissions summary.
 * GET /api/pos/fos/permissions/employee-summary/<employee_id>/
 */
export async function getEmployeePermissionsSummary(employeeId) {
    const res = await getClient().get(`/api/pos/fos/permissions/employee-summary/${employeeId}/`);
    return res.data;
}
// =============================================================================
// TICKET MESSAGES API
// =============================================================================
/**
 * Get all messages for a ticket.
 * GET /api/pos/fos/support/tickets/<ticket_id>/messages/
 */
export async function getTicketMessages(ticketId) {
    const res = await getClient().get(`/api/pos/fos/support/tickets/${ticketId}/messages/`);
    return res.data;
}
/**
 * The Sprout conversation that preceded this ticket — what the customer already
 * explained, and what the AI already told them. Read-only context for the human
 * agent so the customer never has to repeat themselves.
 *
 * `has_transcript: false` (with a `reason`) is a normal answer, not an error: the
 * ticket may have been raised by phone or WhatsApp with no AI chat behind it.
 * Excludes the model's internal reasoning — only turns the customer actually saw.
 *
 * GET /api/pos/fos/support/tickets/<ticket_id>/ai-transcript/
 */
export async function getTicketAiTranscript(ticketId) {
    const res = await getClient().get(`/api/pos/fos/support/tickets/${ticketId}/ai-transcript/`);
    return res.data;
}
/**
 * Send a message to a ticket.
 * POST /api/pos/fos/support/tickets/<ticket_id>/messages/
 */
export async function sendTicketMessage(ticketId, data) {
    const res = await getClient().post(`/api/pos/fos/support/tickets/${ticketId}/messages/`, data);
    return res.data;
}
/**
 * Explicitly resolve/close a ticket.
 * POST /api/pos/fos/support/tickets/<ticket_id>/resolve/
 */
export async function resolveTicket(ticketId) {
    const res = await getClient().post(`/api/pos/fos/support/tickets/${ticketId}/resolve/`);
    return res.data;
}
/** FOS: list all pending delivery partner cash drop requests. */
export async function listDeliveryCashDrops() {
    const res = await getClient().get('/api/delivery-partner/fos/cash-drops/');
    return res.data;
}
/** FOS: acknowledge a delivery partner cash drop (credit received). */
export async function acknowledgeDeliveryCashDrop(dropId, note) {
    const res = await getClient().post(`/api/delivery-partner/fos/cash-drops/${dropId}/acknowledge/`, { note: note ?? '' });
    return res.data;
}
/**
 * FOS: KYC review queue — delivery partners who have started KYC.
 * GET /api/delivery-partner/fos/kyc/partners/?status=
 */
export async function listKycPartners(status) {
    const res = await getClient().get("/api/delivery-partner/fos/kyc/partners/", {
        params: status ? { status } : undefined,
    });
    return res.data;
}
/**
 * FOS: one partner's profile + documents for review.
 * GET /api/delivery-partner/fos/kyc/partners/<userId>/
 */
export async function getKycPartner(userId) {
    const res = await getClient().get(`/api/delivery-partner/fos/kyc/partners/${userId}/`);
    return res.data;
}
/**
 * FOS: verify or reject a single KYC document (records the reviewer).
 * POST /api/delivery-partner/fos/kyc/documents/<docId>/review/
 */
export async function reviewKycDocument(docId, action, rejectionReason) {
    const res = await getClient().post(`/api/delivery-partner/fos/kyc/documents/${docId}/review/`, { action, rejection_reason: rejectionReason ?? "" });
    return res.data;
}
/**
 * FOS: list delivery-partner withdrawal requests (default pending).
 * GET /api/delivery-partner/fos/withdrawals/?status=
 */
export async function listWithdrawals(status) {
    const res = await getClient().get("/api/delivery-partner/fos/withdrawals/", {
        params: status ? { status } : undefined,
    });
    return res.data;
}
/**
 * FOS: mark a withdrawal PAID (with reference) or REJECTED (refunds the rider).
 * POST /api/delivery-partner/fos/withdrawals/<id>/process/
 */
export async function processWithdrawal(id, action, opts) {
    const res = await getClient().post(`/api/delivery-partner/fos/withdrawals/${id}/process/`, { action, reference: opts?.reference ?? "", note: opts?.note ?? "" });
    return res.data;
}
/**
 * PRIDE program-health aggregates.
 * GET /api/pos/fos/pride/summary/
 */
export async function getPrideSummary() {
    const res = await getClient().get("/api/pos/fos/pride/summary/");
    return res.data;
}
/**
 * All PRIDE members (paginated). Open/highest-invested surface first.
 * GET /api/pos/fos/pride/members/?page=&page_size=&search=&tier=&status=
 */
export async function getPrideMembers(params) {
    const res = await getClient().get("/api/pos/fos/pride/members/", {
        params: { page: 1, page_size: 20, ...params },
    });
    return res.data;
}
/**
 * All referrals across the program (paginated).
 * GET /api/pos/fos/pride/referrals/?page=&page_size=&status=&search=
 */
export async function getPrideReferrals(params) {
    const res = await getClient().get("/api/pos/fos/pride/referrals/", {
        params: { page: 1, page_size: 20, ...params },
    });
    return res.data;
}
/**
 * Outstanding partnership-refund requests (oldest first).
 * GET /api/pos/fos/pride/refunds/?page=&page_size=
 */
export async function getPrideRefundQueue(params) {
    const res = await getClient().get("/api/pos/fos/pride/refunds/", {
        params: { page: 1, page_size: 20, ...params },
    });
    return res.data;
}
/**
 * Approve (authorize 100% principal return) or reject a refund request.
 * POST /api/pos/fos/pride/refunds/<id>/decide/
 */
export async function decidePrideRefund(id, action, note) {
    const res = await getClient().post(`/api/pos/fos/pride/refunds/${id}/decide/`, { action, note });
    return res.data;
}
/** Supply-side health aggregates. GET /api/pos/fos/sourcing/summary/ */
export async function getSourcingSummary() {
    const res = await getClient().get("/api/pos/fos/sourcing/summary/");
    return res.data;
}
/** Farmer roster. GET /api/pos/fos/sourcing/farmers/?page=&page_size=&search= */
export async function getSourcingFarmers(params) {
    const res = await getClient().get("/api/pos/fos/sourcing/farmers/", {
        params: { page: 1, page_size: 20, ...params },
    });
    return res.data;
}
/** One farmer's full profile for the detail drawer. GET /api/pos/fos/sourcing/farmers/{id}/ */
export async function getSourcingFarmerDetail(id) {
    const res = await getClient().get(`/api/pos/fos/sourcing/farmers/${id}/`);
    return res.data;
}
/** Onboard a farmer directly from FOS (auto-approved). POST .../farmers/create/ */
export async function createSourcingFarmer(body) {
    const res = await getClient().post("/api/pos/fos/sourcing/farmers/create/", body);
    return res.data;
}
/** One farmer's running account. GET /api/pos/fos/sourcing/farmers/{id}/ledger/ */
export async function getFarmerLedger(id) {
    const res = await getClient().get(`/api/pos/fos/sourcing/farmers/${id}/ledger/`);
    return res.data;
}
/** Farmer-payout queue. GET /api/pos/fos/sourcing/payouts/?status=&page=&page_size= */
export async function getSourcingPayouts(params) {
    const res = await getClient().get("/api/pos/fos/sourcing/payouts/", {
        params: { page: 1, page_size: 20, ...params },
    });
    return res.data;
}
/** Approve (pay + post ledger debit) or reject a payout. POST .../payouts/{id}/decide/ */
export async function decideSourcingPayout(id, action, opts) {
    const res = await getClient().post(`/api/pos/fos/sourcing/payouts/${id}/decide/`, { action, ...opts });
    return res.data;
}
/** Supplier roster. GET /api/pos/fos/sourcing/suppliers/?status=&search=&page=&page_size= */
export async function getSourcingSuppliers(params) {
    const res = await getClient().get("/api/pos/fos/sourcing/suppliers/", {
        params: { page: 1, page_size: 20, ...params },
    });
    return res.data;
}
/** Onboard a supplier directly from FOS (auto-activated). POST .../suppliers/create/ */
export async function createSourcingSupplier(body) {
    const res = await getClient().post("/api/pos/fos/sourcing/suppliers/create/", body);
    return res.data;
}
/** One supplier's running account. GET /api/pos/fos/sourcing/suppliers/{id}/ledger/ */
export async function getSupplierLedger(id) {
    const res = await getClient().get(`/api/pos/fos/sourcing/suppliers/${id}/ledger/`);
    return res.data;
}
/** Approve onboarding / suspend / revert a supplier. POST .../suppliers/{id}/status/ */
export async function setSupplierStatus(id, newStatus) {
    const res = await getClient().post(`/api/pos/fos/sourcing/suppliers/${id}/status/`, { status: newStatus });
    return res.data;
}
/** Draft a settlement invoice for a period. POST .../suppliers/{id}/invoice/ */
export async function buildSupplierInvoice(id, period_start, period_end) {
    const res = await getClient().post(`/api/pos/fos/sourcing/suppliers/${id}/invoice/`, { period_start, period_end });
    return res.data;
}
/** Unverified supplier KYC docs. GET /api/pos/fos/sourcing/kyc/?page=&page_size= */
export async function getKycQueue(params) {
    const res = await getClient().get("/api/pos/fos/sourcing/kyc/", {
        params: { page: 1, page_size: 20, ...params },
    });
    return res.data;
}
/** Verify / unverify a KYC document. POST /api/pos/fos/sourcing/kyc/{id}/verify/ */
export async function verifyKycDocument(id, verified) {
    const res = await getClient().post(`/api/pos/fos/sourcing/kyc/${id}/verify/`, { verified });
    return res.data;
}
/** Inbound consignment + GRN oversight. GET /api/pos/fos/sourcing/consignments/ */
export async function getSourcingConsignments(params) {
    const res = await getClient().get("/api/pos/fos/sourcing/consignments/", {
        params: { page: 1, page_size: 20, ...params },
    });
    return res.data;
}
/** Settlement invoices. GET /api/pos/fos/sourcing/invoices/?status=&page=&page_size= */
export async function getSourcingInvoices(params) {
    const res = await getClient().get("/api/pos/fos/sourcing/invoices/", {
        params: { page: 1, page_size: 20, ...params },
    });
    return res.data;
}
/** Mark an invoice paid (posts the ledger debit). POST .../invoices/{id}/settle/ */
export async function settleSupplierInvoice(id, transaction_ref) {
    const res = await getClient().post(`/api/pos/fos/sourcing/invoices/${id}/settle/`, { transaction_ref });
    return res.data;
}
/** Recognition program aggregates. GET /api/pos/fos/recognition/summary/ */
export async function getRecognitionSummary() {
    const res = await getClient().get("/api/pos/fos/recognition/summary/");
    return res.data;
}
/** Cross-staff incentive leaderboard. GET /api/pos/fos/recognition/leaderboard/ */
export async function getRecognitionLeaderboard(params) {
    const res = await getClient().get("/api/pos/fos/recognition/leaderboard/", {
        params: { page: 1, page_size: 20, ...params },
    });
    return res.data;
}
/** Appreciation-event feed. GET /api/pos/fos/recognition/events/ */
export async function getRecognitionEvents(params) {
    const res = await getClient().get("/api/pos/fos/recognition/events/", {
        params: { page: 1, page_size: 20, ...params },
    });
    return res.data;
}
/** Wastage scorecards. GET /api/pos/fos/recognition/wastage/ */
export async function getRecognitionWastage(params) {
    const res = await getClient().get("/api/pos/fos/recognition/wastage/", {
        params: { page: 1, page_size: 20, ...params },
    });
    return res.data;
}
/** Manually award positive recognition. POST /api/pos/fos/recognition/award/ */
export async function awardRecognition(body) {
    const res = await getClient().post("/api/pos/fos/recognition/award/", body);
    return res.data;
}
/** Manually log a private nudge / warning. POST /api/pos/fos/recognition/flag/ */
export async function flagRecognition(body) {
    const res = await getClient().post("/api/pos/fos/recognition/flag/", body);
    return res.data;
}
// — Categories —
export async function getCatalogCategories(params) {
    const res = await getClient().get("/api/pos/fos/catalog/categories/", {
        params: { page: 1, page_size: 50, ...params },
    });
    return res.data;
}
export async function createCatalogCategory(body) {
    const res = await getClient().post("/api/pos/fos/catalog/categories/", body);
    return res.data;
}
export async function updateCatalogCategory(id, body) {
    const res = await getClient().patch(`/api/pos/fos/catalog/categories/${id}/`, body);
    return res.data;
}
export async function deleteCatalogCategory(id) {
    await getClient().delete(`/api/pos/fos/catalog/categories/${id}/`);
}
// — Subcategories —
export async function getCatalogSubCategories(params) {
    const res = await getClient().get("/api/pos/fos/catalog/subcategories/", {
        params: { page: 1, page_size: 50, ...params },
    });
    return res.data;
}
export async function createCatalogSubCategory(body) {
    const res = await getClient().post("/api/pos/fos/catalog/subcategories/", body);
    return res.data;
}
export async function updateCatalogSubCategory(id, body) {
    const res = await getClient().patch(`/api/pos/fos/catalog/subcategories/${id}/`, body);
    return res.data;
}
export async function deleteCatalogSubCategory(id) {
    await getClient().delete(`/api/pos/fos/catalog/subcategories/${id}/`);
}
export async function getCatalogProducts(params) {
    const res = await getClient().get("/api/pos/fos/catalog/products/", {
        params: { page: 1, page_size: 20, ...params },
    });
    return res.data;
}
export async function getCatalogProduct(id) {
    const res = await getClient().get(`/api/pos/fos/catalog/products/${id}/`);
    return res.data;
}
export async function createCatalogProduct(body) {
    const res = await getClient().post("/api/pos/fos/catalog/products/", body);
    return res.data;
}
export async function updateCatalogProduct(id, body) {
    const res = await getClient().patch(`/api/pos/fos/catalog/products/${id}/`, body);
    return res.data;
}
export async function deleteCatalogProduct(id) {
    await getClient().delete(`/api/pos/fos/catalog/products/${id}/`);
}
// — Product images —
// The primary image is `base_image` (drives card/detail WebP renditions); the
// gallery is the ordered `images` (ProductImage). Uploads are multipart.
/** Replace the product's primary image (`base_image`). Returns the updated product. */
export async function uploadCatalogProductBaseImage(id, file) {
    const fd = new FormData();
    fd.append("base_image", file);
    const res = await getClient().patch(`/api/pos/fos/catalog/products/${id}/`, fd);
    return res.data;
}
/** Add a gallery image (appended after the current last). */
export async function addCatalogProductImage(productId, file, altText) {
    const fd = new FormData();
    fd.append("image", file);
    if (altText)
        fd.append("alt_text", altText);
    const res = await getClient().post(`/api/pos/fos/catalog/products/${productId}/images/`, fd);
    return res.data;
}
/** Delete one gallery image. */
export async function deleteCatalogProductImage(productId, imageId) {
    await getClient().delete(`/api/pos/fos/catalog/products/${productId}/images/${imageId}/`);
}
/** Reorder the gallery — pass the image ids in the desired order. Returns the new list. */
export async function reorderCatalogProductImages(productId, orderedIds) {
    const res = await getClient().patch(`/api/pos/fos/catalog/products/${productId}/images/`, { order: orderedIds });
    return res.data;
}
/** Active units for the variant unit dropdown. */
export async function getCatalogUnits() {
    const res = await getClient().get("/api/pos/fos/catalog/units/");
    return res.data;
}
/** Add a custom unit to the catalog (de-duped case-insensitively). */
export async function createCatalogUnit(body) {
    const res = await getClient().post("/api/pos/fos/catalog/units/", body);
    return res.data;
}
export async function getCatalogVariants(params) {
    const res = await getClient().get("/api/pos/fos/catalog/variants/", {
        params: { page: 1, page_size: 50, ...params },
    });
    return res.data;
}
export async function createCatalogVariant(body) {
    const res = await getClient().post("/api/pos/fos/catalog/variants/", body);
    return res.data;
}
export async function updateCatalogVariant(id, body) {
    const res = await getClient().patch(`/api/pos/fos/catalog/variants/${id}/`, body);
    return res.data;
}
export async function deleteCatalogVariant(id) {
    await getClient().delete(`/api/pos/fos/catalog/variants/${id}/`);
}
//# sourceMappingURL=fos.js.map