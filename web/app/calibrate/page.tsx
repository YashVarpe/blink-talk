"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { runCalibration, loadCalibration, type CalStep, type FrameSource } from "@/lib/calibrate";
import { startFace } from "@/lib/face";
import type { Frame } from "@/lib/signalCore";

type Raw = { face: boolean; blink: number; lookA: number; lookB: number; yaw: number; pitch: number; fps: number };

/** Same panel as ml/recorder: raw MediaPipe scores, bottom-left, display only. */
function Meter({ label, v, face }: { label: string; v: number; face: boolean }) {
  return (
    <div>
      <div className="flex justify-between"><span>{label}</span><span className="font-mono">{face ? v.toFixed(2) : "no face"}</span></div>
      <div className="mb-1.5 mt-0.5 h-2 rounded bg-[#333]">
        <div className="h-full rounded bg-[#4af]" style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }} />
      </div>
    </div>
  );
}

function RecorderPanel({ r }: { r: Raw | null }) {
  return (
    <aside aria-label="Live eye tracking" className="fixed bottom-4 left-4 z-20 w-[280px] rounded-[10px] bg-black/80 p-3 text-left text-sm text-[#eee]">
      <Meter label="blink" v={r?.blink ?? 0} face={!!r?.face} />
      <Meter label="lookA" v={r?.lookA ?? 0} face={!!r?.face} />
      <Meter label="lookB" v={r?.lookB ?? 0} face={!!r?.face} />
      <div>yaw {r ? r.yaw.toFixed(0) : "-"}° · pitch {r ? r.pitch.toFixed(0) : "-"}° · fps {r ? r.fps : "-"}</div>
    </aside>
  );
}

export default function Calibrate() {
  const video = useRef<HTMLVideoElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [step, setStep] = useState<CalStep | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSaved, setHasSaved] = useState(false);
  const [raw, setRaw] = useState<Raw | null>(null);
  const [camOn, setCamOn] = useState(false);
  const liveRef = useRef({ last: 0, count: 0, fpsT: 0, fps: 0 });
  const listeners = useRef(new Set<(f: Frame) => void>());

  // One face tracker for the whole page: the live bars run from the moment the page opens,
  // and calibration listens to the same frames (MediaPipe can't take two loops on one camera).
  useEffect(() => {
    setHasSaved(!!loadCalibration());
    let stop: (() => void) | null = null;
    let cancelled = false;
    if (video.current) {
      startFace(video.current, (f) => {
        listeners.current.forEach((l) => l(f));
        const r = liveRef.current, now = performance.now();
        r.count++;
        if (now - r.fpsT >= 1000) { r.fps = r.count; r.count = 0; r.fpsT = now; }
        if (now - r.last < 66) return; // ~15 updates/s is plenty for the eye and cheap for React
        r.last = now;
        setRaw({ face: f.faceFound, blink: f.blink, lookA: f.lookA, lookB: f.lookB, yaw: f.yaw, pitch: f.pitch, fps: r.fps });
      })
        .then((s) => (cancelled ? s() : ((stop = s), setCamOn(true))))
        .catch((e) => setError((e as Error).message || "Camera not available"));
    }
    return () => {
      cancelled = true;
      abort.current?.abort();
      stop?.();
    };
  }, []);

  const source: FrameSource = (cb) => {
    listeners.current.add(cb);
    return () => listeners.current.delete(cb);
  };

  const start = async () => {
    if (!video.current || running) return;
    setError(null);
    setRunning(true);
    abort.current = new AbortController();
    try {
      await runCalibration(video.current, setStep, {
        signal: abort.current.signal,
        source: camOn ? source : undefined, // camera failed on load → calibration tries its own
      });
      setHasSaved(true);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message || "Camera not available");
    } finally {
      setRunning(false);
    }
  };

  const dotLeft = step?.dot === "left" ? "4%" : step?.dot === "right" ? "96%" : "50%";
  const done = step?.key === "done";

  return (
    <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-8 p-6 text-center">
      {/* target dot (fixed to the screen edges so eye movements are large) */}
      {running && step && step.key !== "done" && (
        <div
          className="pointer-events-none fixed top-1/2 z-30 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-highlight shadow-glow transition-[left] duration-150"
          style={{ left: dotLeft }}
        />
      )}

      <div className="glass flex w-full flex-col items-center gap-5 rounded-4xl px-8 py-10">
        {step && !done && (
          <p className="caption">
            {`Step ${step.stepIndex + 1} of ${step.steps}${step.reps > 1 ? ` · ${step.rep}/${step.reps}` : ""}`}
          </p>
        )}
        <h1 className="font-display text-6xl font-extrabold italic leading-none tracking-tight md:text-7xl">
          {step ? step.title : "Calibration"}
        </h1>
        <p className="max-w-xl text-2xl leading-relaxed text-muted">
          {error ?? step?.instruction ?? "Sit like you will during use, face centered. About 35 seconds: relax, look left, look right, long blinks."}
        </p>
        <video
          ref={video}
          muted
          playsInline
          className="h-40 w-56 rounded-2xl object-cover"
          style={{ transform: "scaleX(-1)", opacity: camOn || running ? 1 : 0.4 }}
        />
        {step && !step.faceFound && running && (
          <p className="rounded-full bg-danger/20 px-5 py-2 text-lg text-danger">Looking for your face…</p>
        )}

      </div>

      {/* live tracker numbers, fixed bottom-left like the recorder (display only) */}
      <RecorderPanel r={raw} />

      <div className="flex flex-wrap items-center justify-center gap-3">
        {!running && (
          <button onClick={start} className="glow rounded-full bg-highlight px-10 py-5 text-2xl font-semibold text-onhighlight shadow-glow">
            {done || hasSaved ? "Calibrate again" : "Calibrate now"}
          </button>
        )}
        {running && (
          <button onClick={() => abort.current?.abort()} className="glass glow rounded-full px-8 py-5 text-xl font-medium">
            Cancel
          </button>
        )}
        {!running && (hasSaved || done) && (
          <Link href="/talk" className="glow rounded-full bg-highlight px-10 py-5 text-2xl font-semibold text-onhighlight shadow-glow">
            Done
          </Link>
        )}
        <Link href="/" className="glass glow rounded-full px-8 py-5 text-xl font-medium">Back home</Link>
      </div>
    </main>
  );
}
