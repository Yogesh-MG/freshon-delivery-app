/**
 * App version information returned by the backend.
 */
export interface AppVersion {
    minimum_version: string;
    latest_version?: string;
    update_url?: string;
    force_update: boolean;
    message?: string;
}
/**
 * Get minimum required app version and update URL.
 * GET /api/app-config/minimum-version/
 *
 * Used by mobile/Tauri apps on startup to check if the current version
 * is still supported. If current version is below minimum_version,
 * the user is prompted to update.
 */
export declare function getMinimumVersion(): Promise<AppVersion>;
/**
 * Get app feature flags and configuration.
 * GET /api/app-config/features/
 *
 * Returns which features are enabled/disabled for the current app version.
 */
export declare function getFeatureFlags(): Promise<Record<string, boolean>>;
//# sourceMappingURL=app-config.d.ts.map