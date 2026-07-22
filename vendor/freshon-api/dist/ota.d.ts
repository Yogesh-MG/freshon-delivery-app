export interface OtaManifestFile {
    path: string;
    sha256: string;
    size: number;
}
export interface OtaManifest {
    schema: number;
    app: string;
    version: string;
    createdAt: string;
    minNativeVersion: string;
    entry: string;
    files: OtaManifestFile[];
}
export type InvokeFn = <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
export interface OtaConfig {
    /** App id — matches the OTA path segment, e.g. "consumer". */
    app: string;
    /** OTA host base (no trailing slash), e.g. "https://api.freshon.in/ota". */
    baseUrl: string;
    /** The bundle version THIS build shipped with (inject at build time). */
    currentVersion: string;
    /** Native shell version, for the minNativeVersion gate. */
    nativeVersion: string;
    /**
     * Tauri's `invoke` (from "@tauri-apps/api/core"). Passed in so this shared
     * package doesn't hard-depend on @tauri-apps/api. Falls back to the injected
     * global if omitted. When neither is available, the updater is a no-op.
     */
    invoke?: InvokeFn;
    /** Don't re-check more often than this (ms). Default 6h. */
    minCheckIntervalMs?: number;
    /**
     * Apply a freshly-downloaded bundle to the RUNNING app at once — promote it and
     * reload the WebView — instead of waiting for the next launch. Opt-in; used by
     * operator apps (FOS, Fpos) so fixes land immediately. Consumer keeps the
     * default deferred behaviour. Rollback safety is preserved (the reloaded bundle
     * is a trial until it renders + confirms). Default false.
     */
    applyImmediately?: boolean;
    /**
     * Called right before an immediate-apply reload, so the app can veto/defer it
     * (e.g. Fpos mid-sale). Return false to skip the reload this time — the bundle
     * still applies on the next launch. Only consulted when `applyImmediately`.
     */
    onBeforeApply?: (version: string) => boolean;
    /** Optional logger for diagnostics. */
    log?: (msg: string, extra?: unknown) => void;
}
export type OtaStatus = "no-runtime" | "up-to-date" | "skipped-native-gate" | "throttled" | "updated" | "error";
export interface OtaResult {
    status: OtaStatus;
    version?: string;
    filesDownloaded?: number;
    bytesDownloaded?: number;
    error?: string;
}
export declare function createOtaUpdater(config: OtaConfig): {
    check: () => Promise<OtaResult>;
    checkInBackground: () => void;
    confirmBoot: () => void;
};
//# sourceMappingURL=ota.d.ts.map