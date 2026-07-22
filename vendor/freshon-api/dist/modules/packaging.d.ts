export type ProductKind = "SELLABLE" | "PACKAGING" | "CONSUMABLE";
export interface MaterialVariantStock {
    variant_id: number;
    unit: string;
    /** Grams one unit of this material weighs — the bridge between count and pool. */
    unit_grams: number;
    /** Whole units on hand, derived from the gram pool (see MaterialStock). */
    units_available: number;
}
export interface MaterialStock {
    id: number;
    name: string;
    kind: ProductKind;
    category_name: string | null;
    /** Stock is gram-denominated end-to-end, so this is the underlying truth.
     * `units_available` on each variant is this divided by the unit weight — NOT
     * the unit-availability the rest of the catalog uses, which reports 1 for a
     * received batch of 1000 (receive_po_line mints a single token serial). */
    grams_available: number;
    variants: MaterialVariantStock[];
}
export interface PackagingBOMLine {
    id: string;
    /** The pack being made, e.g. "Orange Juice (500 ml)". */
    variant: number;
    variant_label: string;
    material: number;
    material_name: string;
    material_variant: number;
    material_unit: string;
    /** How many of the material ONE pack consumes. */
    qty_per_pack: number;
    is_active: boolean;
    units_available: number;
}
/** FOS: packaging/consumable materials and how many are on hand. */
export declare function listMaterials(params?: {
    kind?: Exclude<ProductKind, "SELLABLE">;
}): Promise<{
    materials: MaterialStock[];
}>;
/** FOS: what a pack consumes. Filter by `variant` for one pack's bill. */
export declare function listPackagingBOM(params?: {
    variant?: number;
}): Promise<{
    lines: PackagingBOMLine[];
}>;
/** FOS: add a material to a pack's bill of materials.
 *
 * The material Product is derived server-side from `material_variant` — two
 * fields naming the same thing is two fields that can disagree. Throws 409 if
 * that material is already on this pack's bill. */
export declare function addPackagingBOMLine(data: {
    variant: number;
    material_variant: number;
    qty_per_pack?: number;
}): Promise<PackagingBOMLine>;
/** FOS: change how many a pack consumes, or deactivate the line. */
export declare function updatePackagingBOMLine(id: string, data: {
    qty_per_pack?: number;
    is_active?: boolean;
}): Promise<PackagingBOMLine>;
/** FOS: remove a line entirely. Deactivating is usually better — it keeps the
 * history of what a pack used to consume. */
export declare function deletePackagingBOMLine(id: string): Promise<void>;
//# sourceMappingURL=packaging.d.ts.map