/**
 * Settings view: tune the Pomodoro durations and the long-break cadence.
 * Values are pushed live into the Pomodoro machine and persisted through the
 * Rust store (debounced) so they survive restarts.
 */
import type { Pomodoro, PomodoroConfig } from "../timer/pomodoro";
import { saveConfig } from "../store/persistence";

export interface SettingsView {
  el: HTMLElement;
  /** Repaint the steppers from the current config (call when shown). */
  refresh: () => void;
}

interface Field {
  key: keyof PomodoroConfig;
  label: string;
  unit: string;
  min: number;
  max: number;
  /** Stored value = shown value * scale (60 turns minutes into seconds). */
  scale: number;
}

const FIELDS: Field[] = [
  { key: "workSec", label: "Concentración", unit: "min", min: 1, max: 90, scale: 60 },
  { key: "shortSec", label: "Descanso corto", unit: "min", min: 1, max: 30, scale: 60 },
  { key: "longSec", label: "Descanso largo", unit: "min", min: 1, max: 60, scale: 60 },
  { key: "longEvery", label: "Largo cada", unit: "pomos", min: 2, max: 8, scale: 1 },
  { key: "gallerySec", label: "Galería cambia", unit: "seg", min: 1, max: 60, scale: 1 },
];

export function createSettingsView(
  pomodoro: Pomodoro,
  onBack: () => void,
): SettingsView {
  const view = document.createElement("section");
  view.className = "view view--ajustes";

  const header = document.createElement("div");
  header.className = "ajustes__header";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "ajustes__back";
  back.textContent = "←";
  back.title = "Volver";
  back.setAttribute("aria-label", "Volver al temporizador");
  back.addEventListener("click", onBack);
  const heading = document.createElement("h2");
  heading.className = "ajustes__title";
  heading.textContent = "AJUSTES";
  header.append(back, heading);

  const list = document.createElement("div");
  list.className = "ajustes__list";

  // --- persistence (debounced) ---------------------------------------------
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const persist = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const c = pomodoro.getConfig();
      saveConfig({
        workSec: c.workSec,
        shortSec: c.shortSec,
        longSec: c.longSec,
        longEvery: c.longEvery,
        gallerySec: c.gallerySec,
      }).catch((err) => console.error("[CrocHat] could not save config:", err));
    }, 300);
  };

  // --- one stepper per field ------------------------------------------------
  const painters: Array<() => void> = [];

  for (const f of FIELDS) {
    const row = document.createElement("div");
    row.className = "ajustes__row";

    const label = document.createElement("span");
    label.className = "ajustes__label";
    label.textContent = f.label;

    const stepper = document.createElement("div");
    stepper.className = "ajustes__stepper";
    const minus = stepBtn("−", `Bajar ${f.label}`);
    const value = document.createElement("span");
    value.className = "ajustes__value";
    const plus = stepBtn("+", `Subir ${f.label}`);
    const unit = document.createElement("span");
    unit.className = "ajustes__unit";
    unit.textContent = f.unit;

    const read = () => Math.round(pomodoro.getConfig()[f.key] / f.scale);
    const paint = () => {
      value.textContent = String(read());
    };
    const set = (shown: number) => {
      const clamped = Math.min(f.max, Math.max(f.min, shown));
      pomodoro.setConfig({ [f.key]: clamped * f.scale } as Partial<PomodoroConfig>);
      paint();
      persist();
    };

    minus.addEventListener("click", () => set(read() - 1));
    plus.addEventListener("click", () => set(read() + 1));

    stepper.append(minus, value, plus, unit);
    row.append(label, stepper);
    list.appendChild(row);
    painters.push(paint);
  }

  // --- footer: reset the completed-pomodoro counter -------------------------
  const footer = document.createElement("div");
  footer.className = "ajustes__footer";
  const resetCount = document.createElement("button");
  resetCount.type = "button";
  resetCount.className = "ajustes__reset";
  resetCount.textContent = "Reiniciar contador";
  resetCount.title = "Poner en cero los pomodoros completados";
  resetCount.addEventListener("click", () => pomodoro.hardReset());
  footer.append(resetCount);

  // --- credit ---------------------------------------------------------------
  const credit = document.createElement("p");
  credit.className = "ajustes__credit";
  credit.innerHTML =
    'Idea y creación<br><b>vhhatziry</b><br>github.com/vhhatziry';

  view.append(header, list, footer, credit);

  const refresh = () => painters.forEach((p) => p());

  return { el: view, refresh };
}

function stepBtn(glyph: string, label: string): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ajustes__step";
  btn.textContent = glyph;
  btn.title = label;
  btn.setAttribute("aria-label", label);
  return btn;
}
