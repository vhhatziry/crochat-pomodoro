/**
 * Native notifications. Uses the plugin to check/request permission, then the
 * Rust `notify` command to actually fire it (per the project's backend design).
 */
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
} from "@tauri-apps/plugin-notification";

let ensured = false;

/** Ask for notification permission once, up front. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (ensured) return true;
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const result = await requestPermission();
      granted = result === "granted";
    }
    ensured = granted;
    return granted;
  } catch {
    // Not running under Tauri (dev/browser) — silently skip notifications.
    return false;
  }
}

export async function notify(title: string, body: string): Promise<void> {
  try {
    const granted = await ensureNotificationPermission();
    if (!granted) return;
    await invoke("notify", { title, body });
  } catch (err) {
    console.error("[CrocHat] notification failed:", err);
  }
}
