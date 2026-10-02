/**
 * Patrones view: local crochet-pattern notes. Each note has a title, free text
 * and an optional row/stitch counter. Persisted through the Rust store commands
 * so it survives app restarts.
 */
import {
  loadPatrones,
  savePatrones,
  type Patron,
} from "../store/persistence";
import { exportPattern } from "../pdf/exportPattern";

export interface PatronesView {
  el: HTMLElement;
  /** Load persisted patterns and render them. */
  refresh: () => Promise<void>;
}

export function createPatronesView(): PatronesView {
  const view = document.createElement("section");
  view.className = "view view--patrones";

  const header = document.createElement("div");
  header.className = "patrones__header";
  const heading = document.createElement("h2");
  heading.className = "patrones__title";
  heading.textContent = "PATRONES";
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "patrones__add";
  addBtn.textContent = "+";
  addBtn.title = "Nuevo patrón";
  addBtn.setAttribute("aria-label", "Nuevo patrón");
  header.append(heading, addBtn);

  const list = document.createElement("div");
  list.className = "patrones__list";

  const empty = document.createElement("p");
  empty.className = "patrones__empty";
  empty.textContent = "Sin patrones aún. Toca + para crear uno.";

  view.append(header, list, empty);
  const status = document.createElement("p");
  status.className = "pattern-status";
  status.setAttribute("role", "status");
  const retry = document.createElement("button");
  retry.textContent = "Reintentar guardado";
  retry.hidden = true;
  view.append(status, retry);

  let patrones: Patron[] = [];
  const scheduleSave = () => {
    status.textContent = "Guardando…";
    savePatrones(patrones).then(() => {
      status.textContent = "Guardado";
      retry.hidden = true;
    }).catch(() => {
      status.textContent = "No se pudo guardar. Tus cambios siguen aquí.";
      retry.hidden = false;
    });
  };
  retry.addEventListener("click", scheduleSave);

  const newId = (): string => crypto.randomUUID();

  const render = () => {
    list.innerHTML = "";
    empty.hidden = patrones.length > 0;
    for (const p of patrones) {
      list.appendChild(renderItem(p));
    }
  };

  const renderItem = (p: Patron): HTMLElement => {
    const item = document.createElement("article");
    item.className = "patron";

    const titleInput = document.createElement("input");
    titleInput.className = "patron__title";
    titleInput.value = p.title;
    titleInput.placeholder = "Título";
    titleInput.addEventListener("input", () => {
      p.title = titleInput.value;
      scheduleSave();
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "patron__del";
    del.textContent = "✕";
    del.title = "Eliminar";
    del.setAttribute("aria-label", "Eliminar patrón");
    del.addEventListener("click", () => {
      patrones = patrones.filter((x) => x.id !== p.id);
      render();
      scheduleSave();
    });

    const top = document.createElement("div");
    top.className = "patron__top";
    top.append(titleInput, del);

    const bodyInput = document.createElement("textarea");
    bodyInput.className = "patron__body";
    bodyInput.value = p.body;
    bodyInput.placeholder = "Notas del patrón…";
    bodyInput.rows = 2;
    bodyInput.addEventListener("input", () => {
      p.body = bodyInput.value;
      scheduleSave();
    });

    // Row counter.
    const counterWrap = document.createElement("div");
    counterWrap.className = "patron__counter";
    const minus = counterBtn("−", "Restar vuelta");
    const value = document.createElement("span");
    value.className = "patron__count-value";
    value.textContent = String(p.counter);
    const plus = counterBtn("+", "Sumar vuelta");
    const label = document.createElement("span");
    label.className = "patron__count-label";
    label.textContent = "vueltas";

    minus.addEventListener("click", () => {
      p.counter = Math.max(0, p.counter - 1);
      value.textContent = String(p.counter);
      scheduleSave();
    });
    plus.addEventListener("click", () => {
      p.counter += 1;
      value.textContent = String(p.counter);
      scheduleSave();
    });

    counterWrap.append(minus, value, plus, label);
    const actions = document.createElement("div");
    actions.className = "pattern-actions";
    const aiLabel = document.createElement("label");
    const ai = document.createElement("input");
    ai.type = "checkbox";
    aiLabel.append(ai, " Diseño con Gemini");
    aiLabel.title = "Envía el título y las notas a Gemini para elegir subtítulo y paleta. Las instrucciones se conservan.";
    const finish = document.createElement("button");
    finish.textContent = "Finalizar → PDF";
    finish.addEventListener("click", async () => {
      finish.disabled = true;
      del.disabled = true;
      status.textContent = ai.checked ? "Diseñando con Gemini…" : "Preparando PDF…";
      try {
        await savePatrones(patrones);
        const path = await exportPattern(structuredClone(p), ai.checked);
        status.textContent = path ? "PDF guardado. Añádelo desde la pestaña PDF para leerlo." : "Exportación cancelada.";
      } catch (error) {
        status.textContent = String(error);
      } finally {
        finish.disabled = false;
        del.disabled = false;
      }
    });
    actions.append(aiLabel, finish);
    item.append(top, bodyInput, counterWrap, actions);
    return item;
  };

  addBtn.addEventListener("click", () => {
    const patron: Patron = { id: newId(), title: "", body: "", counter: 0 };
    patrones.unshift(patron);
    render();
    scheduleSave();
    const firstTitle = list.querySelector<HTMLInputElement>(".patron__title");
    firstTitle?.focus();
  });

  let loading: Promise<void> | null = null;
  let loaded = false;
  addBtn.disabled = true;
  const refresh = async () => {
    if (loaded) return;
    if (loading) return loading;
    loading = (async () => {
      try {
        patrones = await loadPatrones();
        loaded = true;
        addBtn.disabled = false;
        render();
      } catch (err) {
        console.error("[CrocHat] could not load patrones:", err);
        status.textContent = "No se pudieron cargar tus patrones. Vuelve a abrir esta pestaña para reintentar.";
      }
    })();
    await loading;
    loading = null;
  };

  return { el: view, refresh };
}

function counterBtn(glyph: string, label: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "patron__count-btn";
  btn.textContent = glyph;
  btn.title = label;
  btn.setAttribute("aria-label", label);
  return btn;
}
