export type ThemeMode = "light" | "dark" | "system";

const KEY = "habit_tracker_theme";

export function getSavedTheme(): ThemeMode {
  const v = localStorage.getItem(KEY);
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

export function saveTheme(mode: ThemeMode): void {
  localStorage.setItem(KEY, mode);
}

export function applyTheme(mode: ThemeMode): void {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = mode === "dark" || (mode === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}
