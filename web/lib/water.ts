
export function splash(x: number, y: number, strength = 1) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("water-splash", { detail: { x, y, strength } })
  );
}