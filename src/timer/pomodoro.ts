/**
 * Pomodoro finite-state machine.
 *
 * Phases: idle -> working -> (shortBreak | longBreak) -> working -> ...
 * A long break replaces the short break every `longEvery` completed work
 * sessions. All timing lives here; the UI only subscribes to events.
 */

export type Phase = "idle" | "working" | "shortBreak" | "longBreak";

export interface PomodoroConfig {
  /** Work session length, in seconds. */
  workSec: number;
  /** Short break length, in seconds. */
  shortSec: number;
  /** Long break length, in seconds. */
  longSec: number;
  /** A long break happens after this many completed work sessions. */
  longEvery: number;
  /** Seconds between automatic gallery image changes (widget setting). */
  gallerySec: number;
}

export const DEFAULT_CONFIG: PomodoroConfig = {
  workSec: 25 * 60,
  shortSec: 5 * 60,
  longSec: 15 * 60,
  longEvery: 4,
  gallerySec: 3,
};

export interface PomodoroState {
  phase: Phase;
  /** Seconds remaining in the current phase. */
  remaining: number;
  /** Total seconds of the current phase (for progress). */
  total: number;
  running: boolean;
  /** Completed work sessions this session. */
  completed: number;
}

/** Events emitted by the machine. */
export interface PomodoroEvents {
  /** Emitted every second and on any state mutation. */
  tick: PomodoroState;
  /** Emitted when a phase finishes (value = the phase that just ended). */
  complete: { finished: Phase; next: Phase };
}

type Listener<T> = (payload: T) => void;

export class Pomodoro {
  private config: PomodoroConfig;
  private phase: Phase = "idle";
  private remaining: number;
  private total: number;
  private running = false;
  private completed = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  private listeners: {
    [K in keyof PomodoroEvents]: Set<Listener<PomodoroEvents[K]>>;
  } = {
    tick: new Set(),
    complete: new Set(),
  };

  constructor(config: PomodoroConfig = DEFAULT_CONFIG) {
    this.config = { ...config };
    this.total = config.workSec;
    this.remaining = config.workSec;
  }

  // --- subscription ---------------------------------------------------------

  on<K extends keyof PomodoroEvents>(
    event: K,
    listener: Listener<PomodoroEvents[K]>,
  ): () => void {
    this.listeners[event].add(listener);
    return () => this.listeners[event].delete(listener);
  }

  private emitTick(): void {
    const snapshot = this.getState();
    this.listeners.tick.forEach((l) => l(snapshot));
  }

  private emitComplete(finished: Phase, next: Phase): void {
    this.listeners.complete.forEach((l) => l({ finished, next }));
  }

  // --- public state ---------------------------------------------------------

  getState(): PomodoroState {
    return {
      phase: this.phase,
      remaining: this.remaining,
      total: this.total,
      running: this.running,
      completed: this.completed,
    };
  }

  getConfig(): PomodoroConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<PomodoroConfig>): void {
    this.config = { ...this.config, ...config };
    // Re-seed the current phase length if idle so changes are visible.
    if (this.phase === "idle" && !this.running) {
      this.total = this.config.workSec;
      this.remaining = this.config.workSec;
      this.emitTick();
    }
  }

  // --- controls -------------------------------------------------------------

  /** Start (or resume). If idle, begins the first work session. */
  start(): void {
    if (this.running) return;
    if (this.phase === "idle") {
      this.enterPhase("working");
    }
    this.running = true;
    this.intervalId = setInterval(() => this.step(), 1000);
    this.emitTick();
  }

  pause(): void {
    if (!this.running) return;
    this.running = false;
    this.clearInterval();
    this.emitTick();
  }

  toggle(): void {
    this.running ? this.pause() : this.start();
  }

  /** Stop and return to a fresh idle work session (keeps completed count). */
  reset(): void {
    this.clearInterval();
    this.running = false;
    this.phase = "idle";
    this.total = this.config.workSec;
    this.remaining = this.config.workSec;
    this.emitTick();
  }

  /** Reset everything, including the completed-pomodoro counter. */
  hardReset(): void {
    this.completed = 0;
    this.reset();
  }

  /** Skip straight to the next phase (as if the current one finished). */
  skip(): void {
    this.finishPhase();
  }

  // --- internals ------------------------------------------------------------

  private step(): void {
    if (!this.running) return;
    this.remaining -= 1;
    if (this.remaining <= 0) {
      this.remaining = 0;
      this.finishPhase();
      return;
    }
    this.emitTick();
  }

  private finishPhase(): void {
    const finished = this.phase === "idle" ? "working" : this.phase;
    if (finished === "working") {
      this.completed += 1;
    }
    const next = this.nextPhase(finished);
    this.enterPhase(next);
    this.emitComplete(finished, next);
    this.emitTick();
  }

  private nextPhase(finished: Phase): Phase {
    if (finished === "working") {
      const isLong = this.completed % this.config.longEvery === 0;
      return isLong ? "longBreak" : "shortBreak";
    }
    // After any break, go back to work.
    return "working";
  }

  private enterPhase(phase: Phase): void {
    this.phase = phase;
    switch (phase) {
      case "working":
        this.total = this.config.workSec;
        break;
      case "shortBreak":
        this.total = this.config.shortSec;
        break;
      case "longBreak":
        this.total = this.config.longSec;
        break;
      case "idle":
        this.total = this.config.workSec;
        break;
    }
    this.remaining = this.total;
    // Keep the clock running through automatic transitions.
    if (this.running && !this.intervalId) {
      this.intervalId = setInterval(() => this.step(), 1000);
    }
  }

  private clearInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

/** Format seconds as MM:SS. */
export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Human label for a phase (Spanish). */
export function phaseLabel(phase: Phase): string {
  switch (phase) {
    case "working":
      return "Mantente concentrado";
    case "shortBreak":
      return "Descanso corto";
    case "longBreak":
      return "Descanso largo";
    case "idle":
      return "Mantente concentrado";
  }
}
