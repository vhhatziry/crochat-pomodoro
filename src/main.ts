import "./styles/base.css";
import "./styles/themes.css";
import "./styles/widget.css";

import { DEFAULT_CONFIG, Pomodoro } from "./timer/pomodoro";
import { ensureNotificationPermission } from "./notify";
import { loadConfig } from "./store/persistence";
import {
  primeAudio,
  playSwitchOn,
  playSwitchOff,
  playAlarmWork,
  playAlarmBreak,
} from "./audio";
import { createTitlebar } from "./ui/titlebar";
import { createTimerView } from "./ui/timerView";
import { createSettingsView } from "./ui/settingsView";
import { createPatternsPanel } from "./ui/patternsPanel";
import { initTheme, toggleTheme } from "./ui/theme";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";

/** Compact (timer only) and split (timer + pattern panel) window sizes. */
const SIZE_COMPACT = { w: 300, h: 372 };
const SIZE_SPLIT = { w: 680, h: 372 };

async function resizeWindow(w: number, h: number): Promise<void> {
  try {
    const win = getCurrentWindow();
    // A non-resizable window has its min == max locked to the creation size,
    // so setSize alone is clamped. Widen the max/min bounds first, then resize.
    await win.setMinSize(new LogicalSize(SIZE_COMPACT.w, h));
    await win.setMaxSize(new LogicalSize(SIZE_SPLIT.w, h));
    await win.setSize(new LogicalSize(w, h));
  } catch {
    /* not running under Tauri (dev/browser) */
  }
}

async function boot(): Promise<void> {
  await initTheme();
  ensureNotificationPermission();
  primeAudio();

  const app = document.getElementById("app")!;
  const widget = document.createElement("div");
  widget.className = "widget";
  widget.dataset.layout = "compact";

  // --- pomodoro + views -----------------------------------------------------
  const storedConfig = await loadConfig().catch(() => null);
  const pomodoro = new Pomodoro(
    storedConfig ? { ...DEFAULT_CONFIG, ...storedConfig } : DEFAULT_CONFIG,
  );

  const timerView = createTimerView(pomodoro, {
    onSettings: () => showLeft("ajustes"),
    onPatterns: () => setPatterns(!patternsOpen),
    onStageChange: (gallery) => updateGalleryBtn(gallery),
  });
  const settingsView = createSettingsView(pomodoro, () => showLeft("timer"));
  const patternsPanel = createPatternsPanel();

  // --- left column: controls + (timer | settings) ---------------------------
  const controls = document.createElement("div");
  controls.className = "controls";

  const themeSwitch = document.createElement("button");
  themeSwitch.type = "button";
  themeSwitch.className = "control switch";
  themeSwitch.title = "Cambiar tema";
  themeSwitch.setAttribute("aria-label", "Cambiar tema");
  themeSwitch.innerHTML =
    '<span class="switch__icon switch__sun">☀</span>' +
    '<span class="switch__icon switch__moon">☾</span>' +
    '<span class="switch__knob"></span>';

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "control side-btn reset-btn";
  resetBtn.textContent = "↺";
  resetBtn.title = "Reiniciar ciclo";
  resetBtn.setAttribute("aria-label", "Reiniciar el ciclo actual");

  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "control play";
  playBtn.title = "Iniciar / pausar";
  playBtn.setAttribute("aria-label", "Iniciar o pausar");
  playBtn.innerHTML = '<span class="play__icon"></span>';

  const skipBtn = document.createElement("button");
  skipBtn.type = "button";
  skipBtn.className = "control side-btn skip-btn";
  skipBtn.textContent = "⏭";
  skipBtn.title = "Saltar de fase";
  skipBtn.setAttribute("aria-label", "Saltar a la siguiente fase");

  const center = document.createElement("div");
  center.className = "controls__center";
  center.append(resetBtn, playBtn, skipBtn);

  // Right pink button: flips the stage between the duck-heart and the gallery.
  const galleryBtn = document.createElement("button");
  galleryBtn.type = "button";
  galleryBtn.className = "control gallery-btn";
  galleryBtn.setAttribute("aria-label", "Cambiar entre personaje y galería");
  const updateGalleryBtn = (gallery: boolean) => {
    galleryBtn.textContent = gallery ? "🩷" : "🖼";
    galleryBtn.title = gallery ? "Ver el personaje" : "Ver galería de imágenes";
  };
  updateGalleryBtn(false);

  controls.append(themeSwitch, center, galleryBtn);

  const leftStack = document.createElement("div");
  leftStack.className = "left-stack";
  leftStack.append(timerView.el, settingsView.el);

  const timerShell = document.createElement("div");
  timerShell.className = "timer-shell";
  timerShell.append(controls, leftStack);

  const body = document.createElement("div");
  body.className = "body";
  body.append(timerShell, patternsPanel.el);

  // --- left view switch (timer | settings) ----------------------------------
  const showLeft = (view: "timer" | "ajustes") => {
    const onTimer = view === "timer";
    timerView.el.hidden = !onTimer;
    settingsView.el.hidden = onTimer;
    center.hidden = !onTimer; // reset/play/skip only when the timer is shown
    if (view === "ajustes") settingsView.refresh();
  };
  showLeft("timer");

  // --- pattern panel open/close (resizes the window) ------------------------
  let patternsOpen = false;
  const setPatterns = (openIt: boolean) => {
    if (openIt === patternsOpen) return;
    patternsOpen = openIt;
    widget.dataset.layout = openIt ? "split" : "compact";
    if (openIt) {
      patternsPanel.refresh();
      playSwitchOn();
      resizeWindow(SIZE_SPLIT.w, SIZE_SPLIT.h);
    } else {
      playSwitchOff();
      resizeWindow(SIZE_COMPACT.w, SIZE_COMPACT.h);
    }
  };

  // --- wiring ---------------------------------------------------------------
  playBtn.addEventListener("click", () => pomodoro.toggle());
  resetBtn.addEventListener("click", () => pomodoro.reset());
  skipBtn.addEventListener("click", () => pomodoro.skip());
  galleryBtn.addEventListener("click", () => {
    const gallery = timerView.toggleStage();
    updateGalleryBtn(gallery);
    (gallery ? playSwitchOn : playSwitchOff)();
  });

  pomodoro.on("tick", (s) => {
    playBtn.classList.toggle("is-playing", s.running);
  });

  // Cozy alarm sound on every phase change.
  pomodoro.on("complete", ({ finished }) => {
    if (finished === "working") playAlarmWork();
    else playAlarmBreak();
  });

  themeSwitch.addEventListener("click", async () => {
    const theme = await toggleTheme();
    themeSwitch.classList.toggle("switch--on", theme === "purple");
  });

  // --- assemble -------------------------------------------------------------
  widget.append(createTitlebar(), body);
  app.appendChild(widget);

  // Reflect the loaded theme on the switch.
  themeSwitch.classList.toggle(
    "switch--on",
    document.documentElement.getAttribute("data-theme") === "purple",
  );
}

boot();
