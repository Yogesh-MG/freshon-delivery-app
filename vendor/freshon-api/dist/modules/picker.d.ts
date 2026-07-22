import type { PickerOrder, PickerGeoVerifyRequest, PickerGeoVerifyResponse, PickerScanRequest } from "../types";
/**
 * Verify picker is within the hub's geo-fence.
 * POST /api/picker/geo-verify/
 */
export declare function geoVerify(data: PickerGeoVerifyRequest): Promise<PickerGeoVerifyResponse>;
/**
 * Get the picker's order queue, sorted by dispatch deadline.
 * GET /api/picker/queue/
 */
export declare function getQueue(): Promise<PickerOrder[]>;
/**
 * Accept an order from the queue.
 * POST /api/picker/queue/{orderId}/accept/
 */
export declare function acceptOrder(orderId: string): Promise<PickerOrder>;
/**
 * Scan a QR/barcode on a product batch to verify it matches the pick item.
 * POST /api/picker/queue/{orderId}/scan/
 */
export declare function scanItem(orderId: string, data: PickerScanRequest): Promise<{
    verified: boolean;
    message: string;
}>;
/**
 * Mark an order as fully packed.
 * POST /api/picker/queue/{orderId}/pack/
 */
export declare function packOrder(orderId: string): Promise<{
    message: string;
    status: string;
}>;
/**
 * Hand over a packed order to a delivery partner.
 * POST /api/picker/queue/{orderId}/handover/
 */
export declare function handoverOrder(orderId: string): Promise<{
    message: string;
    delivery_partner?: string;
}>;
//# sourceMappingURL=picker.d.ts.map