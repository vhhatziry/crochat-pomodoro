/**
 * Side-by-side pattern panel. Sits to the right of the pomodoro when open and
 * offers two tabs:
 *   - "PDF"    : open a crochet-pattern PDF and read it next to the timer.
 *   - "Patrón" : write your own notes (title + text + row counter), persisted.
 */
import { createPatronesView } from "./patronesView";
import { loadPdfs, savePdfs, flushLibraryWrites } from "../store/persistence";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createPdfReader } from "../pdf/reader";
import { uniqueLibraryPaths } from "../store/writeQueue";

export interface PatternsPanel {
  el: HTMLElement;
  refresh: () => void;
}

export function createPatternsPanel(options: { standalone?: boolean } = {}): PatternsPanel {
  const panel = document.createElement("section");
  panel.className = "panel";

  const tabs = document.createElement("div");
  tabs.className = "panel__tabs";
  const tabPdf = tabBtn("PDF");
  const tabNota = tabBtn("Patrón");
  tabs.append(tabPdf, tabNota);
  const detach = tabBtn("↗ Ventana");
  detach.title = "Abrir patrones en una ventana redimensionable";
  if (!options.standalone) tabs.append(detach);

  const pdfView = createPdfView();
  const patrones = createPatronesView();
  pdfView.el.classList.add("panel__pane");
  patrones.el.classList.add("panel__pane");

  const body = document.createElement("div");
  body.className = "panel__body";
  body.append(pdfView.el, patrones.el);

  panel.append(tabs, body);
  const detached = document.createElement("p");
  detached.className = "panel__detached";
  detached.textContent = "Tus patrones están en otra ventana. Puedes moverla, maximizarla y cambiar su tamaño. Al cerrarla, vuelven aquí.";
  detached.hidden = true;
  panel.append(detached);
  let separated = false;
  const lockPanel = (locked: boolean) => {
    separated = locked;
    body.hidden = locked;
    body.inert = locked;
    detached.hidden = !locked;
    tabPdf.disabled = tabNota.disabled = locked;
    detach.textContent = locked ? "↗ Ver ventana" : "↗ Ventana";
  };
  if (!options.standalone) {
    const closedListener = listen("patterns-closed", async () => {
      detach.disabled = true;
      await Promise.all([patrones.refresh(true), pdfView.refresh(true)]);
      lockPanel(false);
      detach.disabled = false;
    });
    void closedListener.then(async () => {
      if (await invoke<boolean>("patterns_window_open")) lockPanel(true);
    }).catch(() => {});
    detach.addEventListener("click", async () => {
      detach.disabled = true;
      lockPanel(true);
      try {
        await closedListener;
        await flushLibraryWrites();
        await invoke("open_patterns_window", { tab: active, pdf: active === "pdf" ? pdfView.currentPath() : null });
      } catch (error) {
        lockPanel(false);
        window.alert(`No se pudo abrir la ventana de patrones: ${String(error)}`);
      } finally { detach.disabled = false; }
    });
  }

  let active: "pdf" | "nota" = "pdf";
  const show = (which: "pdf" | "nota") => {
    active = which;
    pdfView.el.hidden = which !== "pdf";
    patrones.el.hidden = which !== "nota";
    tabPdf.classList.toggle("is-active", which === "pdf");
    tabNota.classList.toggle("is-active", which === "nota");
    if (which === "nota") patrones.refresh();
    else pdfView.refresh();
  };
  tabPdf.addEventListener("click", () => show("pdf"));
  tabNota.addEventListener("click", () => show("nota"));
  show(options.standalone && new URLSearchParams(location.search).get("tab") === "nota" ? "nota" : "pdf");

  const refresh = () => {
    if (separated) return;
    return active === "nota" ? patrones.refresh() : pdfView.refresh();
  };

  return { el: panel, refresh };
}

function tabBtn(label: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "panel__tab";
  b.textContent = label;
  return b;
}

interface PdfView {
  el: HTMLElement;
  refresh: (reload?: boolean) => Promise<void>;
  currentPath: () => string | null;
}

/** Pretty filename from an absolute path. */
function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/**
 * PDF library: a scrollable list of the user's pattern PDFs. Click one to read
 * it in an embedded viewer next to the pomodoro. Add via the native picker
 * (multi-select), remove per item. The list is persisted.
 */
function createPdfView(): PdfView {
  const el = document.createElement("div");
  el.className = "pdfview";

  // --- toolbar --------------------------------------------------------------
  const bar = document.createElement("div");
  bar.className = "pdfview__bar";
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "pdfview__back";
  backBtn.textContent = "‹ Lista";
  backBtn.title = "Volver a la lista";
  backBtn.hidden = true;
  const title = document.createElement("span");
  title.className = "pdfview__name";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "pdfview__open";
  addBtn.textContent = "＋ Añadir PDFs";
  addBtn.disabled = true;
  bar.append(backBtn, title, addBtn);

  // --- list -----------------------------------------------------------------
  const list = document.createElement("div");
  list.className = "pdfview__list";
  const empty = document.createElement("p");
  empty.className = "pdfview__empty";
  empty.textContent =
    "Aún no hay PDFs. Toca «Añadir PDFs» para elegir tus patrones. 🧶";

  // --- viewer ---------------------------------------------------------------
  const frameWrap = document.createElement("div");
  frameWrap.className = "pdfview__frame";
  frameWrap.hidden = true;

  el.append(bar, list, empty, frameWrap);

  let pdfs: string[] = [];
  let openedPath: string | null = null;
  const reader = createPdfReader();
  frameWrap.append(reader.el);

  const persist = () => savePdfs(pdfs).catch(() => {
    window.alert("No se guardaron los cambios de la biblioteca PDF. Intenta de nuevo antes de cerrar.");
  });

  const renderList = () => {
    list.innerHTML = "";
    // Only toggle list/empty visibility while the list (not the viewer) is up.
    if (frameWrap.hidden) {
      list.hidden = pdfs.length === 0;
      empty.hidden = pdfs.length > 0;
    }
    pdfs.forEach((path) => {
      const row = document.createElement("div");
      row.className = "pdfrow";
      const open = document.createElement("button");
      open.type = "button";
      open.className = "pdfrow__open";
      open.innerHTML = `<span class="pdfrow__icon">📄</span><span class="pdfrow__label"></span>`;
      open.querySelector(".pdfrow__label")!.textContent = baseName(path);
      open.title = path;
      open.addEventListener("click", () => view(path));
      const del = document.createElement("button");
      del.type = "button";
      del.className = "pdfrow__del";
      del.textContent = "✕";
      del.title = "Quitar de la lista";
      del.setAttribute("aria-label", "Quitar PDF");
      del.addEventListener("click", () => {
        pdfs = pdfs.filter((p) => p !== path);
        renderList();
        persist();
      });
      row.append(open, del);
      list.appendChild(row);
    });
  };

  const showList = () => {
    openedPath = null;
    reader.clear();
    frameWrap.hidden = true;
    list.hidden = pdfs.length === 0;
    empty.hidden = pdfs.length > 0;
    backBtn.hidden = true;
    title.textContent = "";
    addBtn.hidden = false;
  };

  const view = (path: string) => {
    openedPath = path;
    frameWrap.hidden = false;
    list.hidden = true;
    empty.hidden = true;
    backBtn.hidden = false;
    addBtn.hidden = true;
    title.textContent = baseName(path);
    void reader.open(path);
  };

  backBtn.addEventListener("click", showList);

  addBtn.addEventListener("click", async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: true,
        directory: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      const picked = Array.isArray(selected)
        ? selected
        : typeof selected === "string"
          ? [selected]
          : [];
      if (!picked.length) return;
      pdfs = uniqueLibraryPaths([...pdfs, ...picked]);
      renderList();
      persist();
    } catch (err) {
      console.error("[CrocHat] no se pudieron añadir PDFs:", err);
    }
  });

  let loaded = false;
  let refreshing: Promise<void> | undefined;
  const refresh = async (reload = false) => {
    if (reload) { loaded = false; addBtn.disabled = true; list.inert = true; }
    if (loaded) return;
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        pdfs = await loadPdfs();
        loaded = true;
      } catch {
        empty.textContent = "No se pudo cargar la biblioteca. Reabre la pestaña para reintentar.";
        addBtn.disabled = true;
        return;
      }
      addBtn.disabled = false;
      list.inert = false;
      renderList();
      const initialPdf = new URLSearchParams(location.search).get("pdf");
      if (!reload && initialPdf && pdfs.includes(initialPdf)) view(initialPdf);
      else showList();
    })();
    await refreshing;
    refreshing = undefined;
  };

  return { el, refresh, currentPath: () => openedPath };
}
