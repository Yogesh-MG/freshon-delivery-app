// packages/freshon-api/src/modules/packaging.ts
// Packaging/consumable materials — the inputs we buy on purchase orders but never
// sell (bottles, stickers, caps), plus the bill of materials saying what each pack
// consumes. Maps to apps/inventory/packaging_views.py.
//
// A material is an ordinary Product with kind != SELLABLE, so it rides the normal
// PO / GST / supplier-ledger machinery. `kind` is what keeps it out of the shop.
import { getClient } from "../client";
/** FOS: packaging/consumable materials and how many are on hand. */
export async function listMaterials(params) {
    const res = await getClient().get("/api/inventory/materials/", { params });
    return res.data;
}
/** FOS: what a pack consumes. Filter by `variant` for one pack's bill. */
export async function listPackagingBOM(params) {
    const res = await getClient().get("/api/inventory/packaging-bom/", { params });
    return res.data;
}
/** FOS: add a material to a pack's bill of materials.
 *
 * The material Product is derived server-side from `material_variant` — two
 * fields naming the same thing is two fields that can disagree. Throws 409 if
 * that material is already on this pack's bill. */
export async function addPackagingBOMLine(data) {
    const res = await getClient().post("/api/inventory/packaging-bom/", data);
    return res.data;
}
/** FOS: change how many a pack consumes, or deactivate the line. */
export async function updatePackagingBOMLine(id, data) {
    const res = await getClient().patch(`/api/inventory/packaging-bom/${id}/`, data);
    return res.data;
}
/** FOS: remove a line entirely. Deactivating is usually better — it keeps the
 * history of what a pack used to consume. */
export async function deletePackagingBOMLine(id) {
    await getClient().delete(`/api/inventory/packaging-bom/${id}/`);
}
//# sourceMappingURL=packaging.js.map