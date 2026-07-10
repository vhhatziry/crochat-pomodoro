/**
 * Timer view: the heart + character, the big MM:SS display, the phase subtitle
 * and the completed-pomodoro counter. It only reads state via events; all
 * timing lives in the Pomodoro machine.
 */
import {
  formatTime,
  phaseLabel,
  type Pomodoro,
  type PomodoroState,
} from "../timer/pomodoro";
import { notify } from "../notify";
import { createGallery } from "./gallery";

export interface TimerView {
  el: HTMLElement;
  /** Flip the stage between the duck-heart and the image gallery. */
  toggleStage: () => boolean;
  /** True when the gallery (not the heart) is currently shown. */
  isGallery: () => boolean;
}

export interface TimerViewOptions {
  /** Called when the settings (gear) button is pressed. */
  onSettings?: () => void;
  /** Called when the patterns (notebook) button is pressed. */
  onPatterns?: () => void;
  /** Notified whenever the stage flips (true = gallery shown). */
  onStageChange?: (gallery: boolean) => void;
}

export function createTimerView(
  pomodoro: Pomodoro,
  opts: TimerViewOptions = {},
): TimerView {
  const view = document.createElement("section");
  view.className = "view view--timer";

  const subtitle = document.createElement("p");
  subtitle.className = "subtitle";
  subtitle.textContent = phaseLabel("idle");

  // Settings shortcut, top-left corner of the stage.
  const gear = document.createElement("button");
  gear.type = "button";
  gear.className = "gear corner-btn";
  gear.textContent = "⚙";
  gear.title = "Ajustes";
  gear.setAttribute("aria-label", "Abrir ajustes");
  gear.addEventListener("click", () => opts.onSettings?.());

  // Patterns/PDF shortcut, top-right corner of the stage.
  const notebook = document.createElement("button");
  notebook.type = "button";
  notebook.className = "notebook corner-btn";
  notebook.textContent = "📓";
  notebook.title = "Patrones y PDFs";
  notebook.setAttribute("aria-label", "Abrir patrones");
  notebook.addEventListener("click", () => opts.onPatterns?.());

  // Decorative background layer (clovers / flowers come from the CSS theme).
  const decor = document.createElement("div");
  decor.className = "decor";
  decor.setAttribute("aria-hidden", "true");

  const stage = document.createElement("div");
  stage.className = "stage";

  const heart = document.createElement("div");
  heart.className = "heart";
  heart.setAttribute("role", "img");
  heart.setAttribute("aria-label", "Personaje CrocHat");

  const gallery = createGallery({
    getIntervalSec: () => pomodoro.getConfig().gallerySec,
  });
  gallery.el.hidden = true;

  const display = document.createElement("div");
  display.className = "display";
  display.textContent = "25:00";

  stage.append(decor, gear, notebook, heart, gallery.el, display);

  const counter = document.createElement("div");
  counter.className = "counter";
  counter.setAttribute("aria-label", "Pomodoros completados");

  view.append(subtitle, stage, counter);

  // --- stage flip (heart <-> gallery) ---------------------------------------
  let galleryOn = false;
  const applyStage = () => {
    heart.hidden = galleryOn;
    gallery.el.hidden = !galleryOn;
    stage.dataset.mode = galleryOn ? "gallery" : "heart";
    if (galleryOn) gallery.refresh();
    gallery.setActive(galleryOn); // auto-advance only while the gallery is shown
    opts.onStageChange?.(galleryOn);
  };
  const toggleStage = () => {
    galleryOn = !galleryOn;
    applyStage();
    return galleryOn;
  };

  // --- reactive wiring ------------------------------------------------------

  const render = (s: PomodoroState) => {
    display.textContent = formatTime(s.remaining);
    subtitle.textContent = phaseLabel(s.phase);
    view.dataset.phase = s.phase;
    view.dataset.running = String(s.running);
    heart.classList.toggle("heart--resting", s.phase !== "working");
    renderCounter(counter, s.completed);
  };

  pomodoro.on("tick", render);

  pomodoro.on("complete", ({ finished, next }) => {
    const { title, body } = completionMessage(finished, next);
    notify(title, body);
  });

  // Initial paint.
  render(pomodoro.getState());

  return { el: view, toggleStage, isGallery: () => galleryOn };
}

function renderCounter(el: HTMLElement, completed: number): void {
  el.innerHTML = "";
  const shown = Math.min(completed, 8);
  for (let i = 0; i < shown; i++) {
    const pip = document.createElement("span");
    pip.className = "counter__pip";
    el.appendChild(pip);
  }
  if (completed > 8) {
    const extra = document.createElement("span");
    extra.className = "counter__extra";
    extra.textContent = `+${completed - 8}`;
    el.appendChild(extra);
  }
}

function completionMessage(
  finished: string,
  next: string,
): { title: string; body: string } {
  if (finished === "working") {
    const rest = next === "longBreak" ? "descanso largo" : "descanso corto";
    return {
      title: "¡Pomodoro completado! 🍅",
      body: `Buen trabajo. Hora de un ${rest}.`,
    };
  }
  return {
    title: "Descanso terminado",
    body: "A concentrarse de nuevo. ¡Tú puedes!",
  };
}
