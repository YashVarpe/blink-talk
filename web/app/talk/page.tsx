"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DEFAULT_PHRASES, postAlert, postMessage, postStatus, speak, suggest } from "@/lib/api";
import { useSignals } from "@/lib/useSignals";
import { moveSound, selectSound } from "@/lib/sound";
import { Tile } from "@/lib/Tile";
import type { Message } from "@/lib/types";
import type { SignalEvent } from "@/lib/signals";
import { useKeepWarm } from "@/lib/useKeepWarm";
import { muteListening, startListening, sttSupported } from "@/lib/stt";
import { ReplyLock } from "@/lib/replyLock";

/** Roughly how long our own voice plays for `text` (~15 chars/s) plus a margin, so STT ignores it. */
const speakingMs =(text: string) => Math.min(10000, 1500 + text.length * 70);

export default function Talk() {
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
  // After a pick, all replies stay disabled until the caregiver's next message has new replies ready.
  const lock = useRef(new ReplyLock());
  const [locked, setLocked] = useState(false);
  const tiles = phrases.slice(0, 6);

  // Emergency countdown: 5 s to cancel, then alert.
  useEffect(() => {
    if (emergency === null) return;
    if (emergency <= 0) { postAlert("emergency"); setEmergency(null); setBanner("Help has been called"); return; }
    const t = setTimeout(() => setEmergency((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [emergency]);

  const choose = useCallback(async (i: number) => {
    const label = tiles[i];
    if (!label || !lock.current.tryLock()) return; // already answered: wait for the caregiver
    setLocked(lock.current.isLocked); setProgress(0);
    setFlash(i); selectSound(); setSpoken(label);
    setTimeout(() => setFlash(null), 600);
    muteListening(speakingMs(label)); // don't transcribe our own voice as the caregiver
    speak(label); // speak first, so the voice never waits on a network call
    const m = await postMessage("user", label);
    if (m) history.current.push(m);
  }, [tiles]);

  const onCaregiver = useCallback(async (text: string) => {
    const id = lock.current.caregiverSaid();
    setBanner(text);
    const m = await postMessage("caregiver", text);
    if (m) history.current.push(m);
    const s = await suggest(text, history.current.slice(-10));
    if (!lock.current.repliesReady(id)) return; // stale: a newer message is coming, or the user already answered this one
    if (s && s.phrases.length >= 5) { setPhrases(s.phrases); setIdx(0); } // on failure keep old tiles
    setLocked(false);
  }, []);

  useSignals((e: SignalEvent) => {
    if (emergency !== null) { // any select (long blink) cancels
      if (e.type === "select") { setEmergency(null); postAlert("emergency_cancelled"); selectSound(); }
      return;
    }
    const waiting = lock.current.isLocked; // replies disabled until the caregiver answers
    switch (e.type) {
      case "move": if (!resting && !waiting) { setIdx((i) => (i + e.dir + tiles.length) % tiles.length); moveSound(); } break;
      case "hold": setProgress(waiting ? 0 : e.progress); break;
      case "select": if (!resting && !waiting) choose(idx); break;
      case "emergency": setEmergency(5); break;
      case "rest": setResting(e.on); postStatus(e.on ? "resting" : "active"); break;
      case "face": setFaceLost(!e.found); postStatus(e.found ? "active" : "face_lost"); break;
    }
  });

  // Caregiver speech → tiles. Web Speech API (Chrome / Edge / Safari); stt.ts auto-restarts.
  // Without a microphone no caregiver message can arrive, so the replies must never stay locked.
  useEffect(() => {
    const unavailable = () => { setMic("off"); lock.current.release(); setLocked(false); };
    if (!sttSupported()) { unavailable(); return; }
    setMic("on");
    return startListening((text) => { if (text.length >= 2) onCaregiver(text); }, unavailable);
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
              {mic === "on" ? "Listening" : "No microphone"}
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
            disabled={locked}
            onHover={() => setIdx(i)}
            onPick={() => choose(i)}
          />
        ))}
      </section>

      <footer className="flex flex-wrap items-center justify-center gap-3 text-lg text-muted" aria-live="polite">
        <span>{spoken ? `Speaking: “${spoken}”` : "Look left or right to move · long blink to select"}</span>
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