"use client";
import { useEffect, useRef } from "react";
import { SignalEvent, startKeyboardSignals } from "./mockSignals";


export function useSignals(handler: (e: SignalEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => startKeyboardSignals((e) => ref.current(e)), []);
}