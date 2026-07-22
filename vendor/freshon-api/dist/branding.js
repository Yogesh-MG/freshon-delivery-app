// packages/freshon-api/src/branding.ts
// Single source of truth for FreshOn brand assets.
//
// The logo is shipped once with the SDK (packages/freshon-api/assets/) and
// consumed by every app — no per-app copies. Bundlers (Vite / Rollup, used by
// every Freshon Tauri app) statically analyse the `new URL(..., import.meta.url)`
// pattern below, emit the asset into the build output with a content hash, and
// rewrite the URL — so each app gets a cached, fingerprinted logo for free.
//
// Usage:
//   import { logoUrl, logoWithCartUrl, BRAND } from "@freshon/api/branding";
//   <img src={logoUrl} alt={BRAND.name} />
// The compiled module lives at dist/branding.js, so `../assets` resolves to the
// package root's assets/ folder.
export const logoUrl = new URL("../assets/logo.png", import.meta.url).href;
export const logoWithCartUrl = new URL("../assets/logo-with-cart.png", import.meta.url).href;
// Thermal printers are 1-bit: a pixel is ink or it is paper. `logo.png` is
// artwork on an opaque dark-green field, which rasterises to a solid black
// block. This variant is the same mark with the field dropped — black artwork
// on transparency — so it survives the trip to a label. Regenerate it from
// logo.png if the brand mark changes; do not point print code at logoUrl.
//
// Unlike the display logos above, this one is INLINED as a data URI (see
// logo-print-data.ts). The `new URL(..., import.meta.url)` pattern only works
// when the bundler can statically analyse THIS module — but the print path runs
// from the pre-built dist inside node_modules, where Vite's dep optimiser
// rewrites import.meta.url and never emits the asset, so the fetch 404s and the
// label silently prints with no logo. A data URI always resolves.
export { LOGO_PRINT_DATA_URI } from "./logo-print-data";
import { LOGO_PRINT_DATA_URI } from "./logo-print-data";
export const logoPrintUrl = LOGO_PRINT_DATA_URI;
export const BRAND = {
    name: "FreshOn",
    legalName: "FreshOn.in",
    tagline: "Farm-to-Consumer, Harvested Today",
};
//# sourceMappingURL=branding.js.map