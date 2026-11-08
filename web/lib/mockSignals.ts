// Keyboard mock of Yash's signals.ts. Keep available in real build via ?keys=1.
// ← → move · Space held = hold/select · U undo · E emergency · R rest toggle · F face lost toggle
export type SignalEvent =
  | { type: "move"; dir: -1 | 1 }
  | { type: "hold"; progress: number }
  | { type: "select" }
  | { type: "undo" }
  | { type: "emergency" }
  | { type: "rest"; on: boolean }
  | { type: "face"; found: boolean };

const HOLD_MS = 600;

export function startKeyboardSignals(onEvent: (e: SignalEvent) => void): () => void {
  let holdStart = 0, raf = 0, resting = false, faceFound = true;
  const tick = () => {
    const p = Math.min(1, (performance.now() - holdStart) / HOLD_MS);
    onEvent({ type: "hold", progress: p });
    if (p < 1) raf = requestAnimationFrame(tick);
  };
  const down = (e: KeyboardEvent) => {
    if (e.repeat) return;
    switch (e.key) {
      case "ArrowLeft": onEvent({ type: "move", dir: -1 }); break;
      case "ArrowRight": onEvent({ type: "move", dir: 1 }); break;
      case " ": e.preventDefault(); holdStart = performance.now(); raf = requestAnimationFrame(tick); break;
      case "u": case "U": onEvent({ type: "undo" }); break;
      case "e": case "E": onEvent({ type: "emergency" }); break;
      case "r": case "R": resting = !resting; onEvent({ type: "rest", on: resting }); break;
      case "f": case "F": faceFound = !faceFound; onEvent({ type: "face", found: faceFound }); break;
    }
  };
  const up = (e: KeyboardEvent) => {
    if (e.key !== " ") return;
    cancelAnimationFrame(raf);
    const held = performance.now() - holdStart;
    onEvent({ type: "hold", progress: 0 });
    if (held >= HOLD_MS) onEvent({ type: "select" });
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
}