"use client";
import { useEffect, useRef } from "react";

const CELL = 5; // screen pixels per simulation cell (bigger = faster, blockier)
const DAMPING = 0.978; // how quickly ripples fade

export function WaterBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let W = 0;
    let H = 0;
    let prev = new Float32Array(0);
    let curr = new Float32Array(0);
    let next = new Float32Array(0);
    let img: ImageData | null = null;
    let raf = 0;
    let last = 0;
    let lastX = -1;
    let lastY = -1;
    let ambient = 0;

    const init = () => {
      W = Math.ceil(window.innerWidth / CELL);
      H = Math.ceil(window.innerHeight / CELL);
      canvas.width = W;
      canvas.height = H;
      prev = new Float32Array(W * H);
      curr = new Float32Array(W * H);
      next = new Float32Array(W * H);
      img = ctx.createImageData(W, H);
    };

    // Push the water surface up around a screen point
    const disturb = (px: number, py: number, amount: number) => {
      const cx = Math.floor(px / CELL);
      const cy = Math.floor(py / CELL);
      const r = 5;
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          const xx = cx + x;
          const yy = cy + y;
          if (xx < 1 || yy < 1 || xx >= W - 1 || yy >= H - 1) continue;
          const d = Math.sqrt(x * x + y * y);
          if (d <= r) curr[yy * W + xx] += amount * (1 - d / (r + 1));
        }
      }
    };

    // One step of the wave equation
    const step = () => {
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = y * W + x;
          const v =
            ((curr[i - 1] + curr[i + 1] + curr[i - W] + curr[i + W]) * 0.5 - prev[i]) *
            DAMPING;
          next[i] = v > 300 ? 300 : v < -300 ? -300 : v;
        }
      }
      const t = prev;
      prev = curr;
      curr = next;
      next = t;
    };

    // Turn water heights into light and shadow on a deep-blue gradient
    const draw = () => {
      if (!img) return;
      const d = img.data;
      for (let y = 0; y < H; y++) {
        const g = y / H;
        const r0 = 6 - 3 * g;
        const g0 = 18 - 8 * g;
        const b0 = 44 - 18 * g;
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          const p = i * 4;
          let light = 0;
          let h = 0;
          if (x > 0 && y > 0 && x < W - 1 && y < H - 1) {
            light = (curr[i + 1] - curr[i - 1] + curr[i + W] - curr[i - W]) * -0.22;
            h = curr[i];
          }
          d[p] = Math.max(0, Math.min(255, r0 + light * 0.7));
          d[p + 1] = Math.max(0, Math.min(255, g0 + light * 1.4 + h * 0.05));
          d[p + 2] = Math.max(0, Math.min(255, b0 + light * 2.2 + h * 0.12));
          d[p + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    };

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      // ~30 fps keeps the CPU free for face tracking
      if (document.hidden || t - last < 33) return;
      last = t;
      ambient -= 1;
      if (ambient <= 0) {
        // slow random drops so the water is never completely still
        disturb(
          Math.random() * window.innerWidth,
          Math.random() * window.innerHeight,
          160 + Math.random() * 120
        );
        ambient = 60 + Math.random() * 90;
      }
      step();
      draw();
    };

    const onMove = (e: PointerEvent) => {
      if (lastX >= 0) {
        const speed = Math.min(60, Math.hypot(e.clientX - lastX, e.clientY - lastY));
        if (speed > 2) disturb(e.clientX, e.clientY, speed * 3.6);
      }
      lastX = e.clientX;
      lastY = e.clientY;
    };

    const onSplash = (e: Event) => {
      const { x, y, strength } = (
        e as CustomEvent<{ x: number; y: number; strength: number }>
      ).detail;
      disturb(x, y, 520 * strength);
    };

    init();
    draw();
    if (!reduced) {
      raf = requestAnimationFrame(loop);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("water-splash", onSplash);
    }
    window.addEventListener("resize", init);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("water-splash", onSplash);
      window.removeEventListener("resize", init);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}