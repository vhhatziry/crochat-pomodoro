import { getCurrentWindow } from "@tauri-apps/api/window";
import { flushLibraryWrites } from "../store/persistence";

export async function installCloseGuard(): Promise<void> {
  try {
    await getCurrentWindow().onCloseRequested(async (event) => {
      try {
        await flushLibraryWrites();
      } catch {
        event.preventDefault();
        window.alert("No se guardaron los últimos cambios. Vuelve a intentar guardar antes de cerrar.");
      }
    });
  } catch { /* browser preview has no native window */ }
}
