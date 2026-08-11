import "@testing-library/jest-dom";

/**
 * jsdom implements neither half of the object-URL API. The proof drawer holds a
 * captured photo as one so step 2 can show it back, and revokes it on cleanup,
 * so both have to exist for any test that reaches the camera.
 */
if (typeof URL.createObjectURL !== "function") {
  let handle = 0;
  URL.createObjectURL = () => `blob:test/${++handle}`;
  URL.revokeObjectURL = () => {};
}

/**
 * Warm Intl before any test runs.
 *
 * The first `toLocaleString` in a worker loads ICU data, which on a loaded
 * machine took long enough to blow a 5 s per-test budget — so whichever test
 * happened to format the first date or amount failed, at random, while passing
 * on its own. Paying the cost here spends it once per file, in setup, where it
 * belongs.
 */
new Date().toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric" });
(0).toLocaleString("en-IN", { minimumFractionDigits: 2 });

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
