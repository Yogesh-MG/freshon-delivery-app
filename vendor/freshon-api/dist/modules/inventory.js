// packages/freshon-api/src/modules/inventory.ts
// Inventory & catalog module — categories, batches, farmer profiles.
// Maps to Django's apps/inventory/ endpoints.
import { getClient } from "../client";
// ─── Categories ───────────────────────────────────────────────────────
/**
 * List all categories (lightweight — no nested subcategories).
 * GET /api/inventory/categories/
 */
export async function listCategories() {
    const res = await getClient().get("/api/inventory/categories/");
    return res.data;
}
/**
 * Get a single category with its nested subcategories.
 * GET /api/inventory/categories/{slug}/
 */
export async function getCategory(slug) {
    const res = await getClient().get(`/api/inventory/categories/${slug}/`);
    return res.data;
}
/**
 * Get only the subcategories for a category.
 * GET /api/inventory/categories/{slug}/subcategories/
 */
export async function getSubcategories(slug) {
    const res = await getClient().get(`/api/inventory/categories/${slug}/subcategories/`);
    return res.data;
}
/**
 * List product batches — the main shop endpoint.
 * GET /api/inventory/batches/
 */
export async function listBatches(filters) {
    const params = {};
    if (filters?.category)
        params["category_slug"] = filters.category;
    if (filters?.product_id)
        params["product_id"] = String(filters.product_id);
    if (filters?.organic !== undefined)
        params["is_organic"] = String(filters.organic);
    if (filters?.farmFresh !== undefined)
        params["is_farm_fresh"] = String(filters.farmFresh);
    if (filters?.search)
        params["search"] = filters.search;
    if (filters?.page)
        params["page"] = String(filters.page);
    if (filters?.pageSize)
        params["page_size"] = String(filters.pageSize);
    const res = await getClient().get("/api/inventory/batches/", { params });
    return res.data;
}
/**
 * Get a single batch by ID.
 * GET /api/inventory/batches/{id}/
 */
export async function getBatch(id) {
    const res = await getClient().get(`/api/inventory/batches/${id}/`);
    return res.data;
}
// ─── Packet Ingestion (PackingPlan / IngestionAssignment) ─────────────
/**
 * Get (creating on first access) a batch's packing plan — how many packets
 * are planned/committed/reserved/available. Pass `variantId` when sizing
 * against a retail size other than the batch's own native variant (a
 * cross-variant ingestion assignment) — the response shape switches to
 * CrossVariantAvailability in that case, since PackingPlan doesn't apply.
 * GET /api/inventory/batches/{id}/packing-plan/[?variant_id=X]
 */
export async function getPackingPlan(batchId, variantId) {
    const res = await getClient().get(`/api/inventory/batches/${batchId}/packing-plan/`, { params: variantId ? { variant_id: String(variantId) } : undefined });
    return res.data;
}
/**
 * Commit the next N packets of a batch's plan as SerializedItems and get
 * their barcodes for printing. Pass `assignmentId` to fulfill a manager-
 * assigned task (draws from that assignment's reserved capacity instead of
 * the free pool); omit it for free self-service claiming.
 * POST /api/inventory/batches/{id}/claim-packets/
 */
export async function claimPackets(batchId, args) {
    const res = await getClient().post(`/api/inventory/batches/${batchId}/claim-packets/`, { count: args.count, assignment_id: args.assignmentId });
    return res.data;
}
/**
 * Manager (FOS) reserves N packets for a specific employee to pack from this
 * raw batch. Hard-locks that capacity out of free self-claim until the
 * employee fulfills it or a manager cancels it. Pass `variantId` when the
 * target retail size differs from the batch's own native variant — this
 * becomes a cross-variant assignment (raw grams reserved on the batch itself
 * rather than its PackingPlan).
 * POST /api/inventory/batches/{id}/ingestion-assignments/
 */
export async function createIngestionAssignment(batchId, args) {
    const res = await getClient().post(`/api/inventory/batches/${batchId}/ingestion-assignments/`, {
        employee_id: args.employeeId,
        packet_count: args.packetCount,
        variant_id: args.variantId,
    });
    return res.data;
}
/**
 * The requesting employee's own open (ASSIGNED/IN_PROGRESS) packing tasks.
 * GET /api/inventory/ingestion-assignments/mine/
 */
export async function listMyIngestionAssignments() {
    const res = await getClient().get("/api/inventory/ingestion-assignments/mine/");
    return res.data.assignments;
}
/**
 * Manager (FOS): all open (ASSIGNED/IN_PROGRESS) assignments, optionally
 * filtered to one batch. Backs the "open tasks / cancel" list on FOS's
 * Packet Ingestion page.
 * GET /api/inventory/ingestion-assignments/
 */
export async function listOpenIngestionAssignments(batchId) {
    const res = await getClient().get("/api/inventory/ingestion-assignments/", { params: batchId ? { batch: batchId } : undefined });
    return res.data.assignments;
}
/**
 * Manager releases a reservation (e.g. the assigned employee is unavailable).
 * POST /api/inventory/ingestion-assignments/{id}/cancel/
 */
export async function cancelIngestionAssignment(assignmentId) {
    const res = await getClient().post(`/api/inventory/ingestion-assignments/${assignmentId}/cancel/`);
    return res.data;
}
// ─── Transfer Requests (warehouse → hub) ──────────────────────────────
// (`listFacilities` / `Facility` already live further down this module.)
/**
 * Raise an instruction to move raw stock to the hub — FOS's answer to a batch
 * that's still sitting at the warehouse and therefore can't be packed yet.
 * It lands as a to-do in Fpick's warehouse screen, where an employee dispatches
 * against it; FOS cannot dispatch it itself (that gate is warehouse-only).
 *
 * `destinationFacility` is optional: FOS runs at the main hub and the backend
 * resolves it. `quantity` is in GRAMS. Origin is server-set to MANUAL.
 * POST /api/inventory/transfer-requests/
 */
export async function createTransferRequest(args) {
    const res = await getClient().post("/api/inventory/transfer-requests/", {
        product: args.product,
        quantity: args.quantityGrams,
        variant: args.variant,
        reason: args.reason ?? "",
        destination_facility: args.destinationFacility,
        source_facility: args.sourceFacility,
    });
    return res.data;
}
/**
 * List transfer requests, e.g. `{ status: "PENDING" }` to show what the
 * warehouse still owes the hub.
 * GET /api/inventory/transfer-requests/
 */
export async function listTransferRequests(params) {
    const res = await getClient().get("/api/inventory/transfer-requests/", { params });
    return res.data;
}
/**
 * Cancel an open transfer request (nothing dispatched yet, or no longer needed).
 * POST /api/inventory/transfer-requests/{id}/cancel/
 */
export async function cancelTransferRequest(id) {
    const res = await getClient().post(`/api/inventory/transfer-requests/${id}/cancel/`);
    return res.data;
}
// ─── Farmer Profiles ──────────────────────────────────────────────────
/**
 * List all verified farmer profiles.
 * GET /api/inventory/farmers/
 */
export async function listFarmers() {
    const res = await getClient().get("/api/inventory/farmers/");
    return res.data;
}
/**
 * Get a single farmer profile.
 * GET /api/inventory/farmers/{id}/
 */
export async function getFarmer(id) {
    const res = await getClient().get(`/api/inventory/farmers/${id}/`);
    return res.data;
}
// ─── Products (Catalog) ───────────────────────────────────────────────
/**
 * List catalog products.
 * GET /api/inventory/products/
 *
 * @deprecated Mistyped — `CatalogProduct` here is an alias of `Category`, so this
 * describes the wrong shape entirely, and it returns only the FIRST PAGE. Use
 * `listAllProducts()`, which is correctly typed and walks the pagination.
 */
export async function listProducts() {
    const res = await getClient().get("/api/inventory/products/");
    return res.data;
}
/**
 * EVERY catalog product, not just the first page.
 *
 * `/api/inventory/products/` paginates at 20. Fetching it once and using
 * `results` — which is what the screens used to do by hand — silently limits the
 * user to the first 20 products in the catalog, with no error and no empty state
 * to notice: the product they want simply isn't in the list. So this walks the
 * pages, and every product picker should use it.
 *
 * GET /api/inventory/products/?page_size=100
 */
export async function listAllProducts() {
    const client = getClient();
    const out = [];
    let url = "/api/inventory/products/?page_size=100";
    while (url) {
        const res = await client.get(url);
        out.push(...(res.data?.results ?? []));
        const next = res.data?.next ?? null;
        // The server returns an absolute `next`; strip the origin so the client's
        // baseURL and auth headers still apply.
        url = next ? next.replace(/^https?:\/\/[^/]+/, "") : null;
    }
    return out;
}
/**
 * "Pack these next" — the AI's ranked worklist: what the hub should be packing
 * right now, most perishable first. Computed live, so a suggestion shrinks as the
 * work gets done.
 *
 * GET /api/inventory/packing-suggestions/
 */
export async function getPackingSuggestions(limit) {
    const res = await getClient().get("/api/inventory/packing-suggestions/", { params: limit ? { limit } : undefined });
    return res.data?.suggestions ?? [];
}
// ─── Facilities (hubs) ────────────────────────────────────────────────
/**
 * Active hubs — for anything that has to be told *which* facility it means
 * (transfer source/destination, the shelf-label grid).
 *
 * `Facility` itself lives in ../types alongside FacilityType.
 * GET /api/inventory/facilities/
 */
export async function listFacilities(type) {
    const res = await getClient().get("/api/inventory/facilities/", { params: type ? { type } : undefined });
    return res.data ?? [];
}
// ─── Utility ──────────────────────────────────────────────────────────
/**
 * Groups flat batch array into product-centric objects with variant arrays.
 * Extracted from Consumer_app's product-utils.ts for shared reuse.
 */
export function groupBatchesByProduct(batches) {
    const productsMap = {};
    for (const b of batches) {
        if (!b)
            continue;
        const pid = b.product_id || b.id;
        if (!productsMap[pid]) {
            productsMap[pid] = {
                id: pid,
                name: b.product_name,
                image: b.batch_image || b.base_image || "/logo.png",
                organic: b.is_organic,
                farmFresh: b.is_farm_fresh,
                harvestDate: b.harvest_date_display || "",
                category: b.category_name,
                category_slug: b.category_slug,
                // Added for compatibility with legacy Product type
                unit: b.variant?.unit || "Unit",
                price: parseFloat(b.price || "0"),
                mrp: b.mrp ? parseFloat(b.mrp) : undefined,
                stock: b.stock_level,
                farmerId: String(b.farmer_id),
                description: b.description || "Freshly harvested produce.",
                benefits: b.benefits || ["Naturally grown"],
                storage: b.storage_instructions || "Store in a cool, dry place.",
                variants: [],
            };
        }
        productsMap[pid].variants.push({
            id: b.id,
            unit: b.variant?.unit || "Unit",
            price: parseFloat(b.price || "0"),
            mrp: b.mrp ? parseFloat(b.mrp) : undefined,
            stock: b.stock_level,
        });
    }
    return Object.values(productsMap);
}
/**
 * Cleans up image URLs that might be double-prefixed by Django's media URL.
 * e.g. https://site.com/media/https%3A/external.com/image.jpg → https://external.com/image.jpg
 */
export function getCleanImageUrl(url) {
    if (!url)
        return "";
    // If the URL contains an external URL nested inside a media path
    if (url.includes("/media/http") || url.includes("/media/https")) {
        const parts = url.split("/media/");
        if (parts.length > 1) {
            let nestedUrl = parts[1];
            // Decode potential URI encoding (like %3A for :)
            nestedUrl = decodeURIComponent(nestedUrl);
            // Ensure it starts with http correctly and has double slashes
            if (nestedUrl.startsWith("http")) {
                if (nestedUrl.startsWith("https:/") && !nestedUrl.startsWith("https://")) {
                    return nestedUrl.replace("https:/", "https://");
                }
                if (nestedUrl.startsWith("http:/") && !nestedUrl.startsWith("http://")) {
                    return nestedUrl.replace("http:/", "http://");
                }
                if (nestedUrl.startsWith("https/") && !nestedUrl.startsWith("https://")) {
                    return nestedUrl.replace("https/", "https://");
                }
                if (nestedUrl.startsWith("http/") && !nestedUrl.startsWith("http://")) {
                    return nestedUrl.replace("http/", "http://");
                }
                return nestedUrl;
            }
        }
    }
    // Handle standard external URLs that might have single slashes
    if (url.startsWith("http")) {
        if (url.startsWith("https:/") && !url.startsWith("https://")) {
            return url.replace("https:/", "https://");
        }
        if (url.startsWith("http:/") && !url.startsWith("http://")) {
            return url.replace("http:/", "http://");
        }
        if (url.startsWith("https/") && !url.startsWith("https://")) {
            return url.replace("https/", "https://");
        }
        if (url.startsWith("http/") && !url.startsWith("http://")) {
            return url.replace("http/", "http://");
        }
        return url;
    }
    // Handle direct domain starting URLs (e.g. images.unsplash.com)
    if (url.startsWith("images.unsplash.com") || url.startsWith("unsplash.com")) {
        return "https://" + url;
    }
    return url;
}
//# sourceMappingURL=inventory.js.map