/**
 * Theme handling. The active theme is a `data-theme` attribute on <html>;
 * all colors come from CSS variables (see styles/themes.css).
 */
import { loadTheme, saveTheme, type ThemeName } from "../store/persistence";

let current: ThemeName = "green";

export function getTheme(): ThemeName {
  return current;
}

function apply(theme: ThemeName): void {
  current = theme;
  document.documentElement.setAttribute("data-theme", theme);
}

/** Load the persisted theme and apply it (called once on boot). */
export async function initTheme(): Promise<void> {
  try {
    const stored = await loadTheme();
    apply(stored);
  } catch {
    apply("green");
  }
}

/** Toggle between green and purple, persisting the choice. */
export async function toggleTheme(): Promise<ThemeName> {
  const next: ThemeName = current === "green" ? "purple" : "green";
  apply(next);
  try {
    await saveTheme(next);
  } catch (err) {
    console.error("[CrocHat] could not save theme:", err);
  }
  return next;
}
