import type { Category, CategoryDetail, Subcategory, InventoryBatch, FarmerProfile, PaginatedResponse, Category as CatalogProduct, PackingPlanSummary, CrossVariantAvailability, ClaimPacketsResult, IngestionAssignment, TransferRequest, Facility, FacilityType } from "../types";
/**
 * List all categories (lightweight — no nested subcategories).
 * GET /api/inventory/categories/
 */
export declare function listCategories(): Promise<PaginatedResponse<Category>>;
/**
 * Get a single category with its nested subcategories.
 * GET /api/inventory/categories/{slug}/
 */
export declare function getCategory(slug: string): Promise<CategoryDetail>;
/**
 * Get only the subcategories for a category.
 * GET /api/inventory/categories/{slug}/subcategories/
 */
export declare function getSubcategories(slug: string): Promise<Subcategory[]>;
export interface BatchFilters {
    /** Filter by category slug */
    category?: string;
    /** Filter by product ID */
    product_id?: number | string;
    /** Filter organic-only batches */
    organic?: boolean;
    /** Filter farm-fresh batches */
    farmFresh?: boolean;
    /** Text search by product name or farmer */
    search?: string;
    /** Pagination */
    page?: number;
    pageSize?: number;
}
/**
 * List product batches — the main shop endpoint.
 * GET /api/inventory/batches/
 */
export declare function listBatches(filters?: BatchFilters): Promise<PaginatedResponse<InventoryBatch>>;
/**
 * Get a single batch by ID.
 * GET /api/inventory/batches/{id}/
 */
export declare function getBatch(id: string): Promise<InventoryBatch>;
/**
 * Get (creating on first access) a batch's packing plan — how many packets
 * are planned/committed/reserved/available. Pass `variantId` when sizing
 * against a retail size other than the batch's own native variant (a
 * cross-variant ingestion assignment) — the response shape switches to
 * CrossVariantAvailability in that case, since PackingPlan doesn't apply.
 * GET /api/inventory/batches/{id}/packing-plan/[?variant_id=X]
 */
export declare function getPackingPlan(batchId: string, variantId?: number | string): Promise<PackingPlanSummary | CrossVariantAvailability>;
/**
 * Commit the next N packets of a batch's plan as SerializedItems and get
 * their barcodes for printing. Pass `assignmentId` to fulfill a manager-
 * assigned task (draws from that assignment's reserved capacity instead of
 * the free pool); omit it for free self-service claiming.
 * POST /api/inventory/batches/{id}/claim-packets/
 */
export declare function claimPackets(batchId: string, args: {
    count: number;
    assignmentId?: string;
}): Promise<ClaimPacketsResult>;
/**
 * Manager (FOS) reserves N packets for a specific employee to pack from this
 * raw batch. Hard-locks that capacity out of free self-claim until the
 * employee fulfills it or a manager cancels it. Pass `variantId` when the
 * target retail size differs from the batch's own native variant — this
 * becomes a cross-variant assignment (raw grams reserved on the batch itself
 * rather than its PackingPlan).
 * POST /api/inventory/batches/{id}/ingestion-assignments/
 */
export declare function createIngestionAssignment(batchId: string, args: {
    employeeId: string;
    packetCount: number;
    variantId?: number | string;
}): Promise<IngestionAssignment>;
/**
 * The requesting employee's own open (ASSIGNED/IN_PROGRESS) packing tasks.
 * GET /api/inventory/ingestion-assignments/mine/
 */
export declare function listMyIngestionAssignments(): Promise<IngestionAssignment[]>;
/**
 * Manager (FOS): all open (ASSIGNED/IN_PROGRESS) assignments, optionally
 * filtered to one batch. Backs the "open tasks / cancel" list on FOS's
 * Packet Ingestion page.
 * GET /api/inventory/ingestion-assignments/
 */
export declare function listOpenIngestionAssignments(batchId?: string): Promise<IngestionAssignment[]>;
/**
 * Manager releases a reservation (e.g. the assigned employee is unavailable).
 * POST /api/inventory/ingestion-assignments/{id}/cancel/
 */
export declare function cancelIngestionAssignment(assignmentId: string): Promise<IngestionAssignment>;
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
export declare function createTransferRequest(args: {
    product: number;
    quantityGrams: number;
    variant?: number;
    reason?: string;
    destinationFacility?: string;
    sourceFacility?: string;
}): Promise<TransferRequest>;
/**
 * List transfer requests, e.g. `{ status: "PENDING" }` to show what the
 * warehouse still owes the hub.
 * GET /api/inventory/transfer-requests/
 */
export declare function listTransferRequests(params?: {
    status?: TransferRequest["status"];
    product?: number;
    destination_facility?: string;
}): Promise<PaginatedResponse<TransferRequest>>;
/**
 * Cancel an open transfer request (nothing dispatched yet, or no longer needed).
 * POST /api/inventory/transfer-requests/{id}/cancel/
 */
export declare function cancelTransferRequest(id: string): Promise<TransferRequest>;
/**
 * List all verified farmer profiles.
 * GET /api/inventory/farmers/
 */
export declare function listFarmers(): Promise<PaginatedResponse<FarmerProfile>>;
/**
 * Get a single farmer profile.
 * GET /api/inventory/farmers/{id}/
 */
export declare function getFarmer(id: number): Promise<FarmerProfile>;
/**
 * List catalog products.
 * GET /api/inventory/products/
 *
 * @deprecated Mistyped — `CatalogProduct` here is an alias of `Category`, so this
 * describes the wrong shape entirely, and it returns only the FIRST PAGE. Use
 * `listAllProducts()`, which is correctly typed and walks the pagination.
 */
export declare function listProducts(): Promise<PaginatedResponse<CatalogProduct>>;
/** A pack size of a product, as `ProductSerializer` returns it. */
export interface InventoryProductVariant {
    id: number;
    unit: string;
    price: number | string;
    mrp?: number | string | null;
    sku?: string;
    weight_grams?: number | null;
}
/** A catalog product, as `ProductSerializer` returns it. */
export interface InventoryProduct {
    id: number;
    name: string;
    category: number | null;
    category_name?: string;
    subcategory: number | null;
    subcategory_name?: string;
    shelf_life_days?: number | null;
    variants: InventoryProductVariant[];
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
export declare function listAllProducts(): Promise<InventoryProduct[]>;
/** One row of "pack these next" — what to pack, how many, and why. */
export interface PackingSuggestion {
    batch_id: string;
    product_id: number;
    product_name: string;
    variant_id: number;
    variant_unit: string;
    /** How many packets the AI thinks should be made now. */
    suggested_packets: number;
    /** How many are actually free to claim (plan minus committed minus reserved). */
    available_packets: number;
    weight_grams_per_packet: number;
    stock_level_grams: number;
    /** Days until the produce is past its shelf life. Null when unknown. */
    days_left: number | null;
    decided_by_agent: boolean;
    /** Human-readable rationale, e.g. "~16 expected over the next 3d; 2 on shelf". */
    reason: string;
}
/**
 * "Pack these next" — the AI's ranked worklist: what the hub should be packing
 * right now, most perishable first. Computed live, so a suggestion shrinks as the
 * work gets done.
 *
 * GET /api/inventory/packing-suggestions/
 */
export declare function getPackingSuggestions(limit?: number): Promise<PackingSuggestion[]>;
/**
 * Active hubs — for anything that has to be told *which* facility it means
 * (transfer source/destination, the shelf-label grid).
 *
 * `Facility` itself lives in ../types alongside FacilityType.
 * GET /api/inventory/facilities/
 */
export declare function listFacilities(type?: FacilityType): Promise<Facility[]>;
/**
 * Groups flat batch array into product-centric objects with variant arrays.
 * Extracted from Consumer_app's product-utils.ts for shared reuse.
 */
export declare function groupBatchesByProduct(batches: InventoryBatch[]): {
    id: string;
    name: string;
    image: string;
    organic: boolean;
    farmFresh: boolean;
    harvestDate: string;
    category: string;
    category_slug: string;
    unit: string;
    price: number;
    mrp: number | undefined;
    stock: number;
    farmerId: string;
    description: string;
    benefits: string[];
    storage: string;
    variants: Array<{
        id: string;
        unit: string;
        price: number;
        mrp: number | undefined;
        stock: number;
    }>;
}[];
/**
 * Cleans up image URLs that might be double-prefixed by Django's media URL.
 * e.g. https://site.com/media/https%3A/external.com/image.jpg → https://external.com/image.jpg
 */
export declare function getCleanImageUrl(url: string | null | undefined): string;
//# sourceMappingURL=inventory.d.ts.map