import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PDFDocumentLoadingTask, type RenderTask } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { convertFileSrc } from "@tauri-apps/api/core";

GlobalWorkerOptions.workerSrc = workerUrl;

export function createPdfReader() {
  const el = document.createElement("div");
  el.className = "pdf-reader";
  const tools = document.createElement("div");
  tools.className = "pdf-reader__tools";
  const button = (label: string) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label; return b;
  };
  const prev = button("‹"); prev.setAttribute("aria-label", "Página anterior");
  const next = button("›"); next.setAttribute("aria-label", "Página siguiente");
  const pageLabel = document.createElement("span");
  const minus = button("−"); minus.setAttribute("aria-label", "Alejar");
  const plus = button("+"); plus.setAttribute("aria-label", "Acercar");
  const fit = button("Ajustar");
  tools.append(prev, pageLabel, next, minus, plus, fit);
  const status = document.createElement("p");
  status.setAttribute("role", "status");
  const scroll = document.createElement("div"); scroll.className = "pdf-reader__scroll";
  const canvas = document.createElement("canvas"); scroll.append(canvas);
  el.append(tools, status, scroll);
  let doc: PDFDocumentProxy | undefined;
  let loading: PDFDocumentLoadingTask | undefined;
  let task: RenderTask | undefined;
  let generation = 0;
  let page = 1;
  let zoom = 1;
  let fitWidth = true;
  const controls = () => {
    prev.disabled = !doc || page <= 1;
    next.disabled = !doc || page >= doc.numPages;
    minus.disabled = plus.disabled = fit.disabled = !doc;
    pageLabel.textContent = doc ? `${page} / ${doc.numPages}` : "—";
  };
  let renderVersion = 0;
  const render = async () => {
    if (!doc) return;
    const version = ++renderVersion;
    const current = doc;
    task?.cancel();
    const previous = task;
    task = undefined;
    try {
      await previous?.promise.catch(() => {});
      const pdfPage = await current.getPage(page);
      if (version !== renderVersion || current !== doc) return;
      const natural = pdfPage.getViewport({ scale: 1 });
      const available = Math.max(180, scroll.clientWidth - 16);
      const scale = fitWidth ? available / natural.width : zoom;
      const viewport = pdfPage.getViewport({ scale });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      task = pdfPage.render({ canvas, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
      await task.promise;
      if (version !== renderVersion) return;
      zoom = scale;
      status.textContent = `${Math.round(scale * 100)} %`;
      controls();
    } catch (error) {
      if (version === renderVersion && (error as Error).name !== "RenderingCancelledException") {
        status.textContent = "No se pudo dibujar esta página.";
      }
    }
  };
  const clear = () => {
    generation++; renderVersion++;
    task?.cancel(); task = undefined;
    if (loading) void loading.destroy();
    loading = undefined; doc = undefined;
    canvas.width = canvas.height = 0;
    controls();
  };
  const open = async (path: string) => {
    clear();
    const version = generation;
    status.textContent = "Cargando PDF…";
    try {
      const loadTask = getDocument({ url: convertFileSrc(path),
        cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/", wasmUrl: "/pdfjs/wasm/" });
      loading = loadTask;
      const result = await loadTask.promise;
      if (version !== generation) { await loadTask.destroy(); return; }
      doc = result; page = 1; fitWidth = true;
      controls(); await render();
    } catch {
      if (version === generation) status.textContent = "No se pudo abrir el PDF. Puede estar movido, protegido o dañado.";
    }
  };
  prev.onclick = () => { if (doc && page > 1) { page--; void render(); } };
  next.onclick = () => { if (doc && page < doc.numPages) { page++; void render(); } };
  minus.onclick = () => { fitWidth = false; zoom = Math.max(.25, zoom - .25); void render(); };
  plus.onclick = () => { fitWidth = false; zoom = Math.min(3, zoom + .25); void render(); };
  fit.onclick = () => { fitWidth = true; void render(); };
  let lastWidth = 0;
  new ResizeObserver(() => {
    if (scroll.clientWidth > 0 && scroll.clientWidth !== lastWidth) {
      lastWidth = scroll.clientWidth;
      if (fitWidth && doc) void render();
    }
  }).observe(scroll);
  controls();
  return { el, open, clear };
}
