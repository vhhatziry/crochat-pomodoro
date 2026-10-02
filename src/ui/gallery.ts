/**
 * Editable image gallery that replaces the floating duck-heart in the stage.
 * The user adds their own images (PNG/JPG/…); they're shown one at a time with
 * ‹ › navigation and can be removed. The list is persisted.
 */
import { loadImages, saveImages } from "../store/persistence";
import { convertFileSrc } from "@tauri-apps/api/core";
import { uniqueLibraryPaths } from "../store/writeQueue";

export interface Gallery {
  el: HTMLElement;
  /** Load persisted images (called when the gallery is first shown). */
  refresh: () => void;
  /** Start/stop the auto-advance ticker (tied to gallery visibility). */
  setActive: (active: boolean) => void;
}

export interface GalleryOptions {
  /** Current seconds between automatic image changes (read live). */
  getIntervalSec?: () => number;
}

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "bmp"];

export function createGallery(opts: GalleryOptions = {}): Gallery {
  const el = document.createElement("div");
  el.className = "gallery";

  // Top-center toolbar: add / remove.
  const tools = document.createElement("div");
  tools.className = "gallery__tools";
  const addBtn = toolBtn("＋", "Agregar imágenes");
  const delBtn = toolBtn("✕", "Quitar imagen actual");
  tools.append(addBtn, delBtn);

  // Image stage with navigation arrows.
  const stage = document.createElement("div");
  stage.className = "gallery__stage";
  const prev = navBtn("‹", "Anterior");
  prev.classList.add("gallery__nav--prev");
  const img = document.createElement("img");
  img.className = "gallery__img";
  img.alt = "Imagen de la galería";
  const next = navBtn("›", "Siguiente");
  next.classList.add("gallery__nav--next");
  stage.append(prev, img, next);

  // Empty state.
  const empty = document.createElement("div");
  empty.className = "gallery__empty";
  const emptyText = document.createElement("p");
  emptyText.textContent = "Tu galería está vacía ✨";
  const emptyAdd = document.createElement("button");
  addBtn.disabled = emptyAdd.disabled = true;
  emptyAdd.type = "button";
  emptyAdd.className = "gallery__empty-add";
  emptyAdd.textContent = "＋ Agregar imágenes";
  empty.append(emptyText, emptyAdd);

  el.append(tools, stage, empty);

  let images: string[] = [];
  let index = 0;
  let active = false;
  let elapsed = 0;
  let ticker: ReturnType<typeof setInterval> | null = null;

  const persist = () => saveImages(images).catch(() => {
    window.alert("No se guardaron los cambios de la galería. Intenta de nuevo antes de cerrar.");
  });

  const advance = (dir: number) => {
    if (images.length < 2) return;
    index = (index + dir + images.length) % images.length;
    elapsed = 0;
    render();
  };

  const startTicker = () => {
    if (ticker) return;
    elapsed = 0;
    ticker = setInterval(() => {
      if (!active || images.length < 2) return;
      elapsed += 1;
      const iv = Math.max(1, Math.round(opts.getIntervalSec?.() ?? 3));
      if (elapsed >= iv) advance(1);
    }, 1000);
  };
  const stopTicker = () => {
    if (ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  };
  const setActive = (a: boolean) => {
    active = a;
    if (a && images.length > 1) startTicker();
    else stopTicker();
  };

  const render = () => {
    const has = images.length > 0;
    empty.hidden = has;
    stage.hidden = !has;
    tools.hidden = !has;
    if (!has) return;
    index = Math.max(0, Math.min(index, images.length - 1));
    try {
      img.src = convertFileSrc(images[index]);
    } catch {
      img.src = images[index];
    }
    const many = images.length > 1;
    prev.hidden = !many;
    next.hidden = !many;
    delBtn.hidden = false;
  };

  const addImages = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: true,
        directory: false,
        filters: [{ name: "Imágenes", extensions: IMAGE_EXT }],
      });
      const picked = Array.isArray(selected)
        ? selected
        : typeof selected === "string"
          ? [selected]
          : [];
      if (!picked.length) return;
      const oldLength = images.length;
      images = uniqueLibraryPaths([...images, ...picked]);
      index = Math.min(oldLength, images.length - 1);
      render();
      persist();
      setActive(active);
    } catch (err) {
      console.error("[CrocHat] no se pudieron agregar imágenes:", err);
    }
  };

  addBtn.addEventListener("click", addImages);
  emptyAdd.addEventListener("click", addImages);
  delBtn.addEventListener("click", () => {
    if (!images.length) return;
    images.splice(index, 1);
    if (index >= images.length) index = images.length - 1;
    render();
    persist();
    setActive(active);
  });
  prev.addEventListener("click", () => advance(-1));
  next.addEventListener("click", () => advance(1));

  let loaded = false;
  let refreshing: Promise<void> | undefined;
  const refresh = async () => {
    if (loaded) {
      render();
      setActive(active);
      return;
    }
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        images = await loadImages();
        loaded = true;
        addBtn.disabled = emptyAdd.disabled = false;
      } catch {
        emptyText.textContent = "No se pudo cargar tu galería. Reabre para reintentar.";
        return;
      }
      render();
      setActive(active);
    })();
    await refreshing;
    refreshing = undefined;
  };

  render();
  return { el, refresh, setActive };
}

function toolBtn(glyph: string, label: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "gallery__tool";
  b.textContent = glyph;
  b.title = label;
  b.setAttribute("aria-label", label);
  return b;
}

function navBtn(glyph: string, label: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "gallery__nav";
  b.textContent = glyph;
  b.title = label;
  b.setAttribute("aria-label", label);
  return b;
}
