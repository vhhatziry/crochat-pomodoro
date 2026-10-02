/**
 * Thin wrappers over the Rust `#[tauri::command]`s that own the local store.
 * Keeping the invoke() calls here means the rest of the UI never touches the
 * bridge directly.
 */
import { invoke } from "@tauri-apps/api/core";
import { createWriteQueue, repairPatternIds, uniqueLibraryPaths } from "./writeQueue";

export interface Patron {
  id: string;
  title: string;
  body: string;
  counter: number;
}

export type ThemeName = "green" | "purple";

/** Persisted Pomodoro settings (mirrors the Rust `PomodoroConfig`). */
export interface ConfigDTO {
  workSec: number;
  shortSec: number;
  longSec: number;
  longEvery: number;
  gallerySec: number;
}

export async function loadPatrones(): Promise<Patron[]> {
  return repairPatternIds(await invoke<Patron[]>("load_patrones"));
}

const patternWrites = createWriteQueue<Patron[]>((patrones) => invoke("save_patrones", { patrones }));
const pdfWrites = createWriteQueue<string[]>((paths) => invoke("save_pdfs", { paths }));
const imageWrites = createWriteQueue<string[]>((paths) => invoke("save_images", { paths }));
export async function flushLibraryWrites(): Promise<void> {
  await Promise.all([patternWrites.flush(), pdfWrites.flush(), imageWrites.flush()]);
}

export async function savePatrones(patrones: Patron[]): Promise<void> {
  await patternWrites.save(patrones);
}

export async function loadTheme(): Promise<ThemeName> {
  const theme = await invoke<string>("load_theme");
  return theme === "purple" ? "purple" : "green";
}

export async function saveTheme(theme: ThemeName): Promise<void> {
  await invoke("save_theme", { theme });
}

/** Load stored settings, or `null` on first run (caller keeps defaults). */
export async function loadConfig(): Promise<ConfigDTO | null> {
  return invoke<ConfigDTO | null>("load_config");
}

export async function saveConfig(config: ConfigDTO): Promise<void> {
  await invoke("save_config", { config });
}

/** The user's PDF pattern library (absolute file paths). */
export async function loadPdfs(): Promise<string[]> {
  return uniqueLibraryPaths(await invoke<string[]>("load_pdfs"));
}

export async function savePdfs(paths: string[]): Promise<void> {
  await pdfWrites.save(uniqueLibraryPaths(paths));
}

/** The user's image gallery (absolute file paths). */
export async function loadImages(): Promise<string[]> {
  return uniqueLibraryPaths(await invoke<string[]>("load_images"));
}

export async function saveImages(paths: string[]): Promise<void> {
  await imageWrites.save(uniqueLibraryPaths(paths));
}
