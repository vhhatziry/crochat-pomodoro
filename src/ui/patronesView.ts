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

  let patrones: Patron[] = [];
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      savePatrones(patrones).catch((err) =>
        console.error("[CrocHat] could not save patrones:", err),
      );
    }, 400);
  };

  const newId = (): string =>
    `p_${performance.now().toString(36)}_${(patrones.length + 1).toString(36)}`;

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
    item.append(top, bodyInput, counterWrap);
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

  const refresh = async () => {
    try {
      patrones = await loadPatrones();
    } catch (err) {
      console.error("[CrocHat] could not load patrones:", err);
      patrones = [];
    }
    render();
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
