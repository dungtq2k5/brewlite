/**
 * The new-order chime, synthesised with the Web Audio API — two short tones, ~300 ms, no audio
 * file and nothing for the CSP to allow. Off by default; the preference lives on the device
 * (`localStorage`). Browsers only let audio start after a tap, so the `AudioContext` is made on a
 * tap (*Enable sound*, or any tap on the board after a reload with the preference on).
 */
const KEY = 'bl_staff_sound';

let context: AudioContext | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function readPreference(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function writePreference(on: boolean) {
  try {
    window.localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // Blocked storage: the choice lasts until the page does.
  }
}

// `useSyncExternalStore` pieces for the toggle.
export const subscribeSound = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const soundOn = (): boolean => readPreference();
export const soundOnOnServer = () => false;

/** Whether the browser will let us play right now — the pill says *Sound on* before that. */
export const audioRunning = () => context?.state === 'running';

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  context ??= new window.AudioContext();
  return context;
}

/** Called from a tap: makes or resumes the context. Any tap on the board calls it. */
export function prepareAudio(): void {
  if (!readPreference()) return;
  const ctx = ensureContext();
  if (ctx && ctx.state !== 'running') void ctx.resume().then(notify, () => undefined);
}

export function setSound(on: boolean): void {
  writePreference(on);
  if (on) {
    const ctx = ensureContext();
    if (ctx) void ctx.resume().then(notify, () => undefined);
    playTones(); // the tap that enables it also says what it sounds like
  }
  notify();
}

function playTones() {
  const ctx = context;
  if (!ctx || ctx.state !== 'running') return;
  const start = ctx.currentTime;
  for (const [offset, hz] of [
    [0, 880],
    [0.16, 1175],
  ] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = hz;
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.3, start + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.14);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start + offset);
    osc.stop(start + offset + 0.15);
  }
}

/** One chime for one new order — only when sound is on and the browser allows it. */
export function playChime(): void {
  if (readPreference()) playTones();
}
