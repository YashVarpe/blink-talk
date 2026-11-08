"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DEFAULT_PHRASES, postAlert, postMessage, postStatus, speak, suggest } from "@/lib/api";
import { useSignals } from "@/lib/useSignals";
import { moveSound, selectSound } from "@/lib/sound";
import { Tile } from "@/lib/Tile";
import type { Message } from "@/lib/types";
import type { SignalEvent } from "@/lib/mockSignals";
import { useKeepWarm } from "@/lib/useKeepWarm";
import { muteListening, startListening, sttSupported } from "@/lib/stt";

const SPELL = "Spell something";

/** Roughly how long our own voice plays for `text` (~15 chars/s) plus a margin, so STT ignores it. */
const speakingMs =(text: string) => Math.min(10000, 1500 + text.length * 70);

export default function Talk() {
  const router = useRouter();
  useKeepWarm();
  const [phrases, setPhrases] = useState<string[]>(DEFAULT_PHRASES);
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [flash, setFlash] = useState<number | null>(null);
  const [banner, setBanner] = useState("Waiting for the caregiver…");
  const [spoken, setSpoken] = useState<string | null>(null);
  const [resting, setResting] = useState(false);
  const [faceLost, setFaceLost] = useState(false);
  const [emergency, setEmergency] = useState<number | null>(null); // seconds left
  const [mic, setMic] = useState<"on" | "off" | null>(null); // null until we know (client only)
  const history = useRef<Message[]>([]);
  const tiles = [...phrases.slice(0, 5), SPELL];

  // Emergency countdown: 5 s to cancel, then alert.
  useEffect(() => {
    if (emergency === null) return;
    if (emergency <= 0) { postAlert("emergency"); setEmergency(null); setBanner("Help has been called"); return; }
    const t = setTimeout(() => setEmergency((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [emergency]);

  const choose = useCallback(async (i: number) => {
    const label = tiles[i];
    if (label === SPELL) { router.push("/spell"); return; }
    setFlash(i); selectSound(); setSpoken(label);
    setTimeout(() => setFlash(null), 600);
    muteListening(speakingMs(label)); // don't transcribe our own voice as the caregiver
    speak(label); // speak first, so the voice never waits on a network call
    const m = await postMessage("user", label);
    if (m) history.current.push(m);
  }, [tiles, router]);

  const onCaregiver = useCallback(async (text: string) => {
    setBanner(text);
    const m = await postMessage("caregiver", text);
    if (m) history.current.push(m);
    const s = await suggest(text, history.current.slice(-10));
    if (s && s.phrases.length >= 5) { setPhrases(s.phrases); setIdx(0); } // on failure keep old tiles
  }, []);

  useSignals((e: SignalEvent) => {
    if (emergency !== null) { // any select (long blink) cancels
      if (e.type === "select") { setEmergency(null); postAlert("emergency_cancelled"); selectSound(); }
      return;
    }
    switch (e.type) {
      case "move": if (!resting) { setIdx((i) => (i + e.dir + tiles.length) % tiles.length); moveSound(); } break;
      case "hold": setProgress(e.progress); break;
      case "select": if (!resting) choose(idx); break;
      case "emergency": setEmergency(5); break;
      case "rest": setResting(e.on); postStatus(e.on ? "resting" : "active"); break;
      case "face": setFaceLost(!e.found); postStatus(e.found ? "active" : "face_lost"); break;
    }
  });

  // Caregiver speech → tiles. Web Speech API (Chrome / Edge / Safari); stt.ts auto-restarts.
  useEffect(() => {
    if (!sttSupported()) { setMic("off"); return; }
    setMic("on");
    return startListening((text) => { if (text.length >= 2) onCaregiver(text); });
  }, [onCaregiver]);

  // Backup (no mic, or demo noise): press "C" to simulate a caregiver question.
  useEffect(() => {
    const h = (ev: KeyboardEvent) => { if (ev.key === "c") onCaregiver("Are you in pain?"); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCaregiver]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-5 p-6">
      <header className="glass flex items-center justify-between gap-4 rounded-4xl px-7 py-5">
        <div>
          <p className="caption">Caregiver said</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">{banner}</p>
        </div>
        <div className="flex items-center gap-3 text-lg">
          {mic && (
            <span className={`rounded-full px-4 py-2 font-medium ${mic === "on" ? "bg-good/15 text-good" : "bg-warn/15 text-warn"}`}>
              {mic === "on" ? "Listening" : "No mic: press C"}
            </span>
          )}
          <span className={`flex items-center gap-2 rounded-full px-4 py-2 font-medium ${faceLost ? "bg-danger/20 text-danger" : "bg-good/15 text-good"}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${faceLost ? "bg-danger" : "bg-good"}`} />
            {faceLost ? "Looking for your face" : "Eyes tracked"}
          </span>
          <Link href="/calibrate" className="glow rounded-full bg-surface2 px-4 py-2 font-medium">Calibrate</Link>
        </div>
      </header>

      <section className="grid flex-1 grid-cols-2 gap-5 md:grid-cols-3" aria-label="Reply choices">
        {tiles.map((t, i) => (
          <Tile
            key={i}
            label={t}
            active={i === idx}
            flash={flash === i}
            progress={i === idx ? progress : 0}
            onHover={() => setIdx(i)}
            onPick={() => choose(i)}
          />
        ))}
      </section>

      <footer className="flex flex-wrap items-center justify-center gap-3 text-lg text-muted" aria-live="polite">
        <span>{spoken ? `Speaking: “${spoken}”` : "Look left or right to move · long blink to select"}</span>
        <span className="rounded-full bg-surface px-4 py-1 text-sm">Keys: ← → move · hold Space select · E emergency · R rest · F face · C caregiver</span>
      </footer>

      {resting && (
        <div role="status" className="fixed inset-0 z-40 flex items-center justify-center bg-black/90 text-6xl font-semibold tracking-tight backdrop-blur-sm">Resting — long blink to wake</div>
      )}
      {emergency !== null && (
        <div role="alertdialog" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-danger text-center text-onhighlight">
          <p className="text-8xl font-bold tracking-tight">Emergency</p>
          <p className="text-4xl font-medium">Calling for help in {emergency}…</p>
          <p className="rounded-full bg-black/80 px-8 py-3 text-3xl font-medium text-white">Long blink to cancel</p>
        </div>
      )}
    </main>
  );
}