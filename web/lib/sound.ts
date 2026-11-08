let ctx: AudioContext | null = null;
export function beep(freq = 660, ms = 90) {
  try {
    ctx = ctx ?? new AudioContext();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = freq; g.gain.value = 0.08;
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + ms / 1000);
  } catch { /* audio blocked: ignore */ }
}
export const moveSound = () => beep(520, 60);
export const selectSound = () => beep(880, 140);