/**
 * Custom title bar (native decorations are disabled). The bar itself is the
 * drag region; the buttons stop propagation so clicking them never drags.
 */
import { getCurrentWindow } from "@tauri-apps/api/window";
import { flushLibraryWrites } from "../store/persistence";

export function createTitlebar(): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "titlebar";
  bar.setAttribute("data-tauri-drag-region", "");

  const title = document.createElement("span");
  title.className = "titlebar__title";
  title.textContent = "CrocHat Timer";

  const buttons = document.createElement("div");
  buttons.className = "titlebar__buttons";

  const minBtn = makeButton("–", "Minimizar", "titlebar__btn");
  const pinBtn = makeButton("▢", "Fijar encima", "titlebar__btn");
  const closeBtn = makeButton("✕", "Cerrar", "titlebar__btn titlebar__btn--close");

  // Null when not running under Tauri (e.g. plain-browser dev) so the UI still
  // renders; the window buttons simply become no-ops.
  let appWindow: ReturnType<typeof getCurrentWindow> | null = null;
  try {
    appWindow = getCurrentWindow();
  } catch {
    appWindow = null;
  }
  let pinned = true;
  appWindow?.onCloseRequested(async (event) => {
    try {
      await flushLibraryWrites();
    } catch {
      event.preventDefault();
      window.alert("No se guardaron los últimos cambios. La ventana seguirá abierta; vuelve a intentar guardar antes de cerrar.");
    }
  });

  minBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    appWindow?.minimize();
  });

  pinBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    pinned = !pinned;
    await appWindow?.setAlwaysOnTop(pinned);
    pinBtn.classList.toggle("is-off", !pinned);
  });

  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    appWindow?.close();
  });

  buttons.append(minBtn, pinBtn, closeBtn);
  bar.append(title, buttons);
  return bar;
}

function makeButton(glyph: string, label: string, className: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = className;
  btn.type = "button";
  btn.textContent = glyph;
  btn.setAttribute("aria-label", label);
  btn.title = label;
  // Buttons deliberately lack `data-tauri-drag-region`, so a mousedown on them
  // never starts a window drag (only elements *with* the attribute do).
  return btn;
}
