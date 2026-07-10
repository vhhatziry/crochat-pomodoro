/**
 * Tiny synthesized sound kit — no audio files, fully offline. Uses the Web
 * Audio API to play soft, "cozy" chiptune blips and a gentle alarm chime.
 * The AudioContext is created lazily and resumed on first user gesture so it
 * works under autoplay policies.
 */

let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Wake the audio context on the first interaction (autoplay policies). */
export function primeAudio(): void {
  const resume = () => {
    getCtx();
    window.removeEventListener("pointerdown", resume);
    window.removeEventListener("keydown", resume);
  };
  window.addEventListener("pointerdown", resume);
  window.addEventListener("keydown", resume);
}

export function setMuted(value: boolean): void {
  muted = value;
}
export function isMuted(): boolean {
  return muted;
}

/** Play a single soft note (sine + gentle bell overtone). */
function note(
  ac: AudioContext,
  freq: number,
  start: number,
  dur: number,
  gain = 0.16,
  type: OscillatorType = "sine",
): void {
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(env).connect(ac.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** Soft ascending blip — used when opening the pattern panel / switching in. */
export function playSwitchOn(): void {
  if (muted) return;
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  note(ac, 660, t, 0.1, 0.12, "triangle");
  note(ac, 880, t + 0.07, 0.12, 0.12, "triangle");
}

/** Soft descending blip — used when closing the pattern panel / switching out. */
export function playSwitchOff(): void {
  if (muted) return;
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  note(ac, 740, t, 0.1, 0.11, "triangle");
  note(ac, 520, t + 0.07, 0.12, 0.11, "triangle");
}

/** Gentle 3-note "cozy" chime when a work session finishes. */
export function playAlarmWork(): void {
  if (muted) return;
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  // C5 - E5 - G5 - C6, bell-like
  const seq = [523.25, 659.25, 783.99, 1046.5];
  seq.forEach((f, i) => {
    note(ac, f, t + i * 0.16, 0.5, 0.17, "sine");
    note(ac, f * 2, t + i * 0.16, 0.3, 0.05, "sine"); // shimmer overtone
  });
}

/** Softer two-note lull when a break finishes (back to work). */
export function playAlarmBreak(): void {
  if (muted) return;
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  const seq = [783.99, 587.33, 523.25];
  seq.forEach((f, i) => note(ac, f, t + i * 0.16, 0.45, 0.15, "sine"));
}
