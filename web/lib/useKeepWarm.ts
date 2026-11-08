"use client";
import { useEffect } from "react";
import { health } from "./api";

/** Keeps the HTTPS connection warm: ping on mount, then every 20 s while the page is visible. */
export function useKeepWarm(everyMs = 20000) {
  useEffect(() => {
    health();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") health();
    }, everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
}