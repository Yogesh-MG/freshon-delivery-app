import { useCallback, useEffect, useState } from "react";

/**
 * Light / dark / follow-the-phone.
 *
 * "system" is the default and, for a delivery app, the one that actually
 * matters: Android already flips to dark in the evening for most riders, and
 * the app should go with it rather than making them find a setting mid-shift.
 * The explicit choices exist because a rider working a bright warehouse at
 * night — or a dim street at noon — is not well served by what the OS thinks.
 */
export type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "freshon_delivery_theme";

export const isThemeChoice = (value: unknown): value is ThemeChoice =>
  value === "light" || value === "dark" || value === "system";

export function storedTheme(): ThemeChoice {
  if (typeof localStorage === "undefined") return "system";
  const raw = localStorage.getItem(STORAGE_KEY);
  return isThemeChoice(raw) ? raw : "system";
}

const prefersDark = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

/** What a choice resolves to right now. */
export function resolveTheme(choice: ThemeChoice): "light" | "dark" {
  return choice === "system" ? (prefersDark() ? "dark" : "light") : choice;
}

/**
 * Paint the choice onto <html>.
 *
 * Also updates `theme-color`, which is what colours the Android status bar
 * behind a Tauri webview — without it the bar stays light while the app goes
 * dark, and the seam is the first thing a rider notices.
 */
export function applyTheme(choice: ThemeChoice): "light" | "dark" {
  const resolved = resolveTheme(choice);
  if (typeof document === "undefined") return resolved;

  document.documentElement.classList.toggle("dark", resolved === "dark");

  const meta = document.querySelector('meta[name="theme-color"]');
  // Must track --background in index.css exactly, or the Android status bar
  // sits a visibly different shade from the page directly under it.
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#111212" : "#F8FAFC");

  return resolved;
}

/**
 * Called from main.tsx before React mounts.
 *
 * Doing it here rather than in an effect is the whole point: applying the class
 * after the first paint shows a white flash on every launch, which on a dark
 * street at 11pm is exactly the thing dark mode was added to prevent.
 */
export function initTheme(): void {
  applyTheme(storedTheme());
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(storedTheme);
  const [resolved, setResolved] = useState<"light" | "dark">(() => resolveTheme(storedTheme()));

  const choose = useCallback((next: ThemeChoice) => {
    setChoice(next);
    localStorage.setItem(STORAGE_KEY, next);
    setResolved(applyTheme(next));
  }, []);

  // Only while following the system: the OS flipping at sunset should carry the
  // app with it, without a reload.
  useEffect(() => {
    if (choice !== "system") return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setResolved(applyTheme("system"));
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [choice]);

  return { choice, resolved, choose };
}
