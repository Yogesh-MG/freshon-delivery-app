// packages/freshon-api/src/modules/app-config.ts
// App configuration module — version checking, settings, feature flags.
// Maps to Django's apps/app_config/views.py endpoints.
import { getClient } from "../client";
/**
 * Get minimum required app version and update URL.
 * GET /api/app-config/minimum-version/
 *
 * Used by mobile/Tauri apps on startup to check if the current version
 * is still supported. If current version is below minimum_version,
 * the user is prompted to update.
 */
export async function getMinimumVersion() {
    const res = await getClient().get("/api/app-config/minimum-version/");
    return res.data;
}
/**
 * Get app feature flags and configuration.
 * GET /api/app-config/features/
 *
 * Returns which features are enabled/disabled for the current app version.
 */
export async function getFeatureFlags() {
    const res = await getClient().get("/api/app-config/features/");
    return res.data;
}
//# sourceMappingURL=app-config.js.map