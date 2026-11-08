"use client";
import { useEffect, useRef } from "react";
import { SignalEvent, startKeyboardSignals } from "./mockSignals";

/**
 * Subscribes to eye signals. Today: keyboard mock only.
 * TODO when Yash's signals.ts lands: if !?keys=1, getUserMedia -> <video> -> startTracking(video, handler).
 * The latest handler is kept in a ref so callers never get stale closures.
 */
export function useSignals(handler: (e: SignalEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => startKeyboardSignals((e) => ref.current(e)), []);
}