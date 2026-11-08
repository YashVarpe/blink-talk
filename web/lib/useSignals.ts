"use client";
import { useEffect, useRef } from "react";
import { startTracking, type SignalEvent } from "./signals";

// Eye tracking (signals.ts) → handler. The camera runs in a hidden <video>; frames never leave the browser.
export function useSignals(handler: (e: SignalEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const emit = (e: SignalEvent) => ref.current(e);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("aria-hidden", "true");
    Object.assign(video.style, { position: "fixed", width: "2px", height: "2px", opacity: "0", pointerEvents: "none", bottom: "0", right: "0" });
    document.body.appendChild(video);

    let stopEyes: (() => void) | null = null;
    let cancelled = false;
    startTracking(video, emit)
      .then((stop) => (cancelled ? stop() : (stopEyes = stop)))
      .catch((err) => console.error("[BlinkTalk] eye tracking failed:", err));

    return () => {
      cancelled = true;
      stopEyes?.();
      video.remove();
    };
  }, []);
}
