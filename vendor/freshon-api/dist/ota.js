// @freshon/api/ota — shared Over-The-Air WebView updater for ALL Freshon apps.
//
// GOLDEN RULE: this NEVER blocks first paint. The app boots whatever bundle the
// native layer already has (embedded on first launch, or the last downloaded
// one). This module only checks for a newer bundle in the BACKGROUND and stages
// it for the NEXT launch.
//
// It pairs with the native plugin `tauri-plugin-freshon-ota` (Part 3), which
// owns file IO, integrity, rollback, and "which bundle to load". This module is
// the orchestrator:
//   status() → fetch latest.json → version + native gate → download ONLY the
//   changed files (sha256-verified) → hand them to native → commit (pending).
//
// If the Tauri runtime or the native plugin isn't present (web/dev builds, or
// before Part 3 is installed), every call is a SAFE NO-OP.
//
// Usage (each app, once, after the app is interactive):
//   import { invoke } from "@tauri-apps/api/core";
//   import { createOtaUpdater } from "@freshon/api/ota";
//   createOtaUpdater({
//     app: "consumer",
//     baseUrl: "https://api.freshon.in/ota",
//     currentVersion: import.meta.env.VITE_BUNDLE_VERSION ?? "0",
//     nativeVersion: "1.0.0",
//     invoke,
//   }).checkInBackground();
// ── Native command names (implemented by tauri-plugin-freshon-ota, Part 3) ────
const CMD = {
    status: "plugin:freshon-ota|status",
    begin: "plugin:freshon-ota|begin_update",
    write: "plugin:freshon-ota|write_file",
    commit: "plugin:freshon-ota|commit_update",
    apply: "plugin:freshon-ota|apply_now",
    confirm: "plugin:freshon-ota|confirm_boot",
};
// ── Helpers ───────────────────────────────────────────────────────────────────
function resolveInvoke(passed) {
    if (passed)
        return passed;
    const w = globalThis;
    const internal = w.__TAURI_INTERNALS__?.invoke;
    return typeof internal === "function" ? internal.bind(w.__TAURI_INTERNALS__) : undefined;
}
async function sha256Hex(buf) {
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
function toBase64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000; // avoid call-stack overflow on large files
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}
/** Returns >0 if a > b, <0 if a < b, 0 if equal. Dotted numeric (e.g. 1.2.0). */
function cmpVersions(a, b) {
    const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
    const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const d = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (d !== 0)
            return d;
    }
    return 0;
}
// ── Public API ──────────────────────────────────────────────────────────────
export function createOtaUpdater(config) {
    const log = config.log ?? (() => { });
    const minInterval = config.minCheckIntervalMs ?? 6 * 60 * 60 * 1000;
    const lastCheckKey = `freshon_ota_lastcheck_${config.app}`;
    const invoke = resolveInvoke(config.invoke);
    let running = false;
    /** Run the full check+download. Returns the outcome (also safe to await in tests). */
    async function check() {
        if (!invoke)
            return { status: "no-runtime" };
        if (running)
            return { status: "throttled" };
        running = true;
        try {
            // 1. Native state. If the plugin isn't installed, status throws → no-op.
            //    The Rust `StatusOut` serializes snake_case (active_version /
            //    native_version); older shells in the field emit exactly that and can't
            //    be updated over-the-air. Read BOTH shapes so this works against every
            //    deployed shell and any future camelCase one. Falling through to the
            //    config values (the last resort) would silently mask the real native
            //    version and defeat the minNativeVersion gate — see the gate below.
            const native = await invoke(CMD.status).catch(() => null);
            if (!native)
                return { status: "no-runtime" };
            const activeVersion = native.activeVersion ?? native.active_version ?? config.currentVersion;
            const nativeVersion = native.nativeVersion ?? native.native_version ?? config.nativeVersion;
            // 2. Fetch the version pointer (cache-busted; server also sends no-store).
            const res = await fetch(`${config.baseUrl}/${config.app}/latest.json?t=${Date.now()}`, {
                cache: "no-store",
            });
            if (!res.ok)
                return { status: "error", error: `manifest HTTP ${res.status}` };
            const manifest = (await res.json());
            // 3. Gates.
            if (manifest.version === activeVersion) {
                return { status: "up-to-date", version: activeVersion };
            }
            if (cmpVersions(manifest.minNativeVersion, nativeVersion) > 0) {
                log(`[ota] ${manifest.version} needs native >= ${manifest.minNativeVersion}; waiting for store update`);
                return { status: "skipped-native-gate", version: manifest.version };
            }
            // 4. Ask native which files are missing/changed vs the active bundle.
            //    Native seeds a staging dir from the active bundle, so unchanged files
            //    are carried over and we download ONLY what's new.
            const { needed } = await invoke(CMD.begin, {
                version: manifest.version,
                files: manifest.files,
            });
            const byPath = new Map(manifest.files.map((f) => [f.path, f]));
            let bytes = 0;
            for (const path of needed) {
                const f = byPath.get(path);
                if (!f)
                    continue;
                // Encode each segment (preserve the slashes) so paths with spaces or
                // other special chars — e.g. "images/WhatsApp Image ….jpeg" — fetch
                // correctly instead of 404'ing and aborting the whole update.
                const encodedPath = path.split("/").map(encodeURIComponent).join("/");
                const fr = await fetch(`${config.baseUrl}/${config.app}/${manifest.version}/${encodedPath}`, { cache: "no-store" });
                if (!fr.ok)
                    throw new Error(`download ${path}: HTTP ${fr.status}`);
                const buf = await fr.arrayBuffer();
                // Integrity: verify before it ever touches disk.
                const hash = await sha256Hex(buf);
                if (hash !== f.sha256)
                    throw new Error(`sha256 mismatch for ${path}`);
                await invoke(CMD.write, { version: manifest.version, path, data: toBase64(buf) });
                bytes += buf.byteLength;
            }
            // 5. Commit: native re-verifies the whole staged bundle against the
            //    manifest, then marks it pending so the NEXT launch boots it. On any
            //    mismatch native discards staging and throws (we stay on the old one).
            await invoke(CMD.commit, { version: manifest.version, manifest });
            log(`[ota] staged ${manifest.version}: ${needed.length} files, ${bytes} bytes`);
            // Opt-in immediate apply: promote the just-committed bundle for THIS process
            // and reload onto it, rather than waiting for the next launch. If the native
            // command is missing (older shell) or the app vetoes it, we fall back to the
            // default deferred behaviour — the bundle still applies next launch.
            if (config.applyImmediately && (config.onBeforeApply?.(manifest.version) ?? true)) {
                // Arm the bundle (pending → trial + repoint serve) THEN reload onto it.
                // Only reload if native actually armed it; otherwise leave everything for
                // the next launch. onBeforeApply is consulted first so a veto never leaves
                // the live serve pointer ahead of the still-running (old) WebView.
                const armed = await invoke(CMD.apply).catch(() => false);
                if (armed) {
                    log(`[ota] applying ${manifest.version} now — reloading`);
                    // Defer a tick so this check() resolves and logs flush before the reload.
                    setTimeout(() => {
                        try {
                            globalThis.location?.reload();
                        }
                        catch {
                            /* ignore */
                        }
                    }, 0);
                }
            }
            return {
                status: "updated",
                version: manifest.version,
                filesDownloaded: needed.length,
                bytesDownloaded: bytes,
            };
        }
        catch (e) {
            const error = e instanceof Error ? e.message : String(e);
            log("[ota] error", error);
            return { status: "error", error };
        }
        finally {
            running = false;
        }
    }
    /**
     * Fire-and-forget background check. Deferred past first paint and throttled to
     * `minCheckIntervalMs`. THIS is what apps call — never `await` it before paint.
     */
    function checkInBackground() {
        let last = 0;
        try {
            last = Number(localStorage.getItem(lastCheckKey) ?? 0);
        }
        catch {
            /* localStorage unavailable — proceed */
        }
        if (Date.now() - last < minInterval) {
            log("[ota] throttled (checked recently)");
            return;
        }
        const run = () => {
            try {
                localStorage.setItem(lastCheckKey, String(Date.now()));
            }
            catch {
                /* ignore */
            }
            void check().then((r) => log(`[ota] result: ${r.status}`, r));
        };
        const ric = globalThis.requestIdleCallback;
        if (ric)
            ric(run, { timeout: 8000 });
        else
            setTimeout(run, 3000);
    }
    /**
     * Tell the native layer the current bundle booted OK — call this ONCE, as soon
     * as the app has rendered (e.g. a top-level `useEffect` on mount). It promotes
     * a trial bundle to "active". If the app crashes before this runs, the native
     * rollback reverts to the previous good bundle on the next launch. Safe no-op
     * off-Tauri.
     */
    function confirmBoot() {
        if (!invoke)
            return;
        void invoke(CMD.confirm).catch(() => { });
    }
    return { check, checkInBackground, confirmBoot };
}
//# sourceMappingURL=ota.js.map