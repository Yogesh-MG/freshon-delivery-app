import type { CustomerProfileData, UpdateProfileRequest } from "../types";
/**
 * Get the customer's full profile (address + preferences + settings) in one call.
 * GET /api/auth/profile-data/
 */
export declare function getProfile(): Promise<CustomerProfileData>;
/**
 * Update profile data — can send any combination of address, preferences, settings.
 * PATCH /api/auth/profile-data/
 */
export declare function updateProfile(data: UpdateProfileRequest): Promise<Partial<CustomerProfileData>>;
//# sourceMappingURL=profile.d.ts.map